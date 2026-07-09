import React, { useState, useEffect } from 'react';
import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { Lock, Unlock, Database, RefreshCw, Key, ShieldCheck, AlertTriangle, UserPlus, List } from 'lucide-react';
import './App.css';

// Read config from Vite environment variables
const AWS_ACCESS_KEY = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
const AWS_SECRET_KEY = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
const AWS_REGION = import.meta.env.VITE_AWS_REGION;
const AWS_KMS_KEY_ID = import.meta.env.VITE_AWS_KMS_KEY_ID;

// Validate if environment variables are set up
const hasCredentials = 
  AWS_ACCESS_KEY && AWS_ACCESS_KEY !== 'YOUR_AWS_ACCESS_KEY' &&
  AWS_SECRET_KEY && AWS_SECRET_KEY !== 'YOUR_AWS_SECRET_KEY' &&
  AWS_REGION && AWS_REGION !== 'YOUR_AWS_REGION' &&
  AWS_KMS_KEY_ID && AWS_KMS_KEY_ID !== 'YOUR_AWS_KMS_KEY_ID';

// Instantiate KMS Client if credentials are present
let kmsClient = null;
if (hasCredentials) {
  kmsClient = new KMSClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET_KEY,
    },
  });
}

function App() {
  const [students, setStudents] = useState([]);
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [decryptedNames, setDecryptedNames] = useState({});
  const [decryptingIds, setDecryptingIds] = useState({});
  const [logs, setLogs] = useState([]);

  // Fetch all students from backend
  const fetchStudents = async () => {
    setFetchLoading(true);
    addLog("Fetching student records from backend MongoDB...");
    try {
      const response = await fetch('http://localhost:8080/api/students');
      if (response.ok) {
        const data = await response.json();
        setStudents(data);
        addLog(`Successfully loaded ${data.length} records from database.`);
      } else {
        addLog("Failed to fetch students. Is the backend server running?", "error");
      }
    } catch (error) {
      addLog(`Error fetching students: ${error.message}`, "error");
    } finally {
      setFetchLoading(false);
    }
  };

  
  useEffect(() => {
    fetchStudents();
  }, []);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message, type }].slice(-8));
  };

  // Helper to encrypt plaintext using KMS
  const encryptText = async (plaintext) => {
    if (!kmsClient) throw new Error("KMS client is not initialized.");
    
    addLog(`[KMS] Encrypting name: "${plaintext}"...`);
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    
    const command = new EncryptCommand({
      KeyId: AWS_KMS_KEY_ID,
      Plaintext: plaintextBytes,
    });
    
    const response = await kmsClient.send(command);
    const ciphertextBlob = response.CiphertextBlob;
    
    // Convert Uint8Array to Base64 String
    const base64Ciphertext = btoa(String.fromCharCode(...ciphertextBlob));
    addLog(`[KMS] Success! Base64 Ciphertext generated.`);
    return base64Ciphertext;
  };

  // Helper to decrypt ciphertext using KMS
  const decryptText = async (base64Ciphertext) => {
    if (!kmsClient) throw new Error("KMS client is not initialized.");
    
    addLog(`[KMS] Decrypting ciphertext...`);
    const binaryString = atob(base64Ciphertext);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const command = new DecryptCommand({
      KeyId: AWS_KMS_KEY_ID,
      CiphertextBlob: bytes,
    });
    
    const response = await kmsClient.send(command);
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(response.Plaintext);
    addLog(`[KMS] Success! Decrypted to: "${plaintext}"`);
    return plaintext;
  };

  // Handle Form Submit (Client-Side Encryption + Save)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !rollNumber.trim()) return;

    if (!hasCredentials) {
      alert("Please configure AWS KMS environment variables in frontend/.env.local first.");
      return;
    }

    setLoading(true);
    try {
      // 1. Encrypt plaintext name on client side
      const base64EncryptedName = await encryptText(name);
      
      // 2. Send pre-encrypted payload to backend
      addLog(`[API] Sending pre-encrypted data to backend...`);
      const response = await fetch('http://localhost:8080/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encryptedName: base64EncryptedName,
          rollNumber: rollNumber,
        }),
      });

      if (response.ok) {
        addLog(`[API] Record saved successfully!`);
        setName('');
        setRollNumber('');
        fetchStudents();
      } else {
        addLog(`[API] Failed to save record: ${response.statusText}`, "error");
      }
    } catch (error) {
      addLog(`[Error] Encryption or Save failed: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Decrypt individual student record locally in the browser
  const handleDecrypt = async (id, encryptedName) => {
    if (!hasCredentials) {
      alert("Please configure AWS KMS environment variables in frontend/.env.local first.");
      return;
    }

    setDecryptingIds(prev => ({ ...prev, [id]: true }));
    try {
      const plaintext = await decryptText(encryptedName);
      setDecryptedNames(prev => ({ ...prev, [id]: plaintext }));
    } catch (error) {
      addLog(`[Error] Decryption failed: ${error.message}`, "error");
      alert(`Decryption failed: ${error.message}`);
    } finally {
      setDecryptingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  // Automatically decrypt all records (for presentation convenience)
  const handleDecryptAll = async () => {
    addLog("Batch decrypting all records locally...");
    for (const student of students) {
      if (student.encryptedName && !decryptedNames[student.id]) {
        await handleDecrypt(student.id, student.encryptedName);
      }
    }
  };

  return (
    <div className="App">
      <header>
        <h1>Zero-Trust Student Registry</h1>
        <p>
          Demonstrating client-side field-level encryption. The server and database only store the encrypted ciphertext, while decryption is done in the user's browser via AWS KMS.
        </p>
      </header>

      {/* Warnings & Status Panel */}
      {!hasCredentials ? (
        <div className="glass-panel" style={{ borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h2 style={{ color: 'var(--danger)' }}><AlertTriangle /> AWS KMS Key Setup Required</h2>
          <p style={{ textAlign: 'left', marginBottom: '15px' }}>
            To run encryption/decryption in the browser, please configure your local AWS variables.
          </p>
          <ol style={{ textAlign: 'left', margin: '0 0 15px 20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <li>Create or open the <code>frontend/.env.local</code> file in this project.</li>
            <li>Replace the placeholders with your AWS Access Key, Secret Key, Region, and KMS Key ID.</li>
            <li>Restart your frontend dev server.</li>
          </ol>
          <div className="status-bar" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <span className="status-indicator">
              <span className="status-dot warning"></span>
              Status: AWS KMS Client Offline
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Using static mock templates</span>
          </div>
        </div>
      ) : (
        <div className="status-bar">
          <span className="status-indicator">
            <span className="status-dot active"></span>
            Status: AWS KMS Client Connected (Zero-Trust Enabled)
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ShieldCheck size={16} /> Secure Client-Side Decrypt
          </span>
        </div>
      )}

      {/* Main Form and Records Section */}
      <div className="app-grid">
        
        {/* Left Side: Register Student Form */}
        <div className="glass-panel">
          <h2><UserPlus size={20} color="var(--primary)" /> Register Student</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name-input">Plaintext Name</label>
              <input 
                id="name-input"
                type="text" 
                placeholder="Enter Student Name (e.g. Alice)" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading || !hasCredentials}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="roll-input">Roll Number (Unencrypted)</label>
              <input 
                id="roll-input"
                type="text" 
                placeholder="Enter Roll Number (e.g. S101)" 
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                disabled={loading || !hasCredentials}
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || !name.trim() || !rollNumber.trim() || !hasCredentials}
            >
              {loading ? (
                <>
                  <span className="spinner"></span> Encrypting & Saving...
                </>
              ) : (
                <>
                  <Lock size={18} /> Encrypt & Save Record
                </>
              )}
            </button>
          </form>

          {/* Real-time Logs Console */}
          <div className="encryption-log-box">
            <div className="log-title"><Database size={12} style={{ marginRight: '4px' }} /> Browser Cryptography Terminal</div>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Waiting for cryptographic operations...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`log-line ${log.type === 'error' ? 'danger' : log.message.includes('Success') ? 'success' : ''}`}>
                  [{log.time}] {log.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Database Records */}
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}><List size={20} color="var(--primary)" /> Database Records (MongoDB)</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn-secondary" 
                onClick={handleDecryptAll}
                disabled={students.length === 0 || !hasCredentials}
              >
                <Unlock size={14} /> Decrypt All
              </button>
              <button 
                className="btn-secondary" 
                onClick={fetchStudents}
                disabled={fetchLoading}
              >
                <RefreshCw size={14} className={fetchLoading ? 'spinner' : ''} /> Refresh
              </button>
            </div>
          </div>

          <div className="table-container">
            {students.length === 0 ? (
              <div className="empty-state">
                No student records found in MongoDB. Register a student on the left to get started!
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Name in DB (Ciphertext)</th>
                    <th>Decrypted Name (Plaintext)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const isDecrypted = decryptedNames[student.id] !== undefined;
                    const isDecrypting = decryptingIds[student.id];

                    return (
                      <tr key={student.id}>
                        <td>{student.rollNumber}</td>
                        <td className="cell-ciphertext" title={student.encryptedName}>
                          {student.encryptedName || "N/A"}
                        </td>
                        <td>
                          {isDecrypted ? (
                            <span className="cell-plaintext success">
                              <Unlock size={14} color="var(--success)" /> {decryptedNames[student.id]}
                            </span>
                          ) : (
                            <span className="cell-plaintext encrypted">
                              <Lock size={14} color="var(--text-muted)" /> [Encrypted]
                            </span>
                          )}
                        </td>
                        <td>
                          <button 
                            className="btn-secondary"
                            onClick={() => handleDecrypt(student.id, student.encryptedName)}
                            disabled={isDecrypted || isDecrypting || !hasCredentials}
                          >
                            {isDecrypting ? (
                              <span className="spinner"></span>
                            ) : isDecrypted ? (
                              'Decrypted'
                            ) : (
                              <>
                                <Unlock size={12} /> Decrypt
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="info-box">
            <h3><Key size={16} /> Zero-Trust Security Concept</h3>
            <p>
              Under this architecture, data is encrypted on the user device before transit and saved securely. The database only sees Base64 encrypted bytes. The cloud server hosting the backend has <strong>no visibility</strong> of the student's name, preventing data leakage in the event of server compromises.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
