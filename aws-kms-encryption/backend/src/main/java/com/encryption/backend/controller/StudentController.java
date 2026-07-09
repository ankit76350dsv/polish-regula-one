package com.encryption.backend.controller;

import com.encryption.backend.model.Student;
import com.encryption.backend.repository.StudentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentRepository studentRepository;

    public StudentController(StudentRepository studentRepository) {
        this.studentRepository = studentRepository;
    }

    /**
     * POST endpoint to store a new student.
     * Expects a client-side pre-encrypted name.
     */
    @PostMapping
    public ResponseEntity<Student> createStudent(@RequestBody Student student) {
        if (student.getEncryptedName() == null || student.getEncryptedName().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        Student savedStudent = studentRepository.save(student);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedStudent);
    }

    /**
     * GET endpoint to retrieve all students.
     * Returns the pre-encrypted names directly for client-side decryption.
     */
    @GetMapping
    public ResponseEntity<List<Student>> getAllStudents() {
        List<Student> students = studentRepository.findAll();
        return ResponseEntity.ok(students);
    }

    /**
     * GET endpoint to retrieve a student by ID.
     * Returns the pre-encrypted name directly for client-side decryption.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Student> getStudentById(@PathVariable String id) {
        return studentRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
