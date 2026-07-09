package com.encryption.backend.controller;

import com.encryption.backend.model.Student;
import com.encryption.backend.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class StudentControllerTest {

    private StudentRepository studentRepository;
    private StudentController studentController;

    @BeforeEach
    void setUp() {
        studentRepository = Mockito.mock(StudentRepository.class);
        studentController = new StudentController(studentRepository);
    }

    @Test
    void testCreateStudentPreEncrypted() {
        Student input = new Student(null, "encrypted-alice", "S101", null);
        
        Student saved = new Student("id1", "encrypted-alice", "S101", null);
        when(studentRepository.save(any(Student.class))).thenReturn(saved);

        ResponseEntity<Student> response = studentController.createStudent(input);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals("id1", response.getBody().getId());
        assertEquals("encrypted-alice", response.getBody().getEncryptedName());
        assertEquals("S101", response.getBody().getRollNumber());
    }

    @Test
    void testGetAllStudents() {
        Student s1 = new Student("id1", "encrypted-alice", "S101", null);
        Student s2 = new Student("id2", "encrypted-bob", "S102", null);
        
        when(studentRepository.findAll()).thenReturn(Arrays.asList(s1, s2));

        ResponseEntity<List<Student>> response = studentController.getAllStudents();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Student> body = response.getBody();
        assertEquals(2, body.size());
        assertEquals("encrypted-alice", body.get(0).getEncryptedName());
        assertEquals("encrypted-bob", body.get(1).getEncryptedName());
    }

    @Test
    void testGetStudentById() {
        Student s1 = new Student("id1", "encrypted-alice", "S101", null);
        
        when(studentRepository.findById("id1")).thenReturn(Optional.of(s1));

        ResponseEntity<Student> response = studentController.getStudentById("id1");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("encrypted-alice", response.getBody().getEncryptedName());
        assertEquals("S101", response.getBody().getRollNumber());
    }
}
