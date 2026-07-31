package com.regulaone.backend.services;

import com.mongodb.client.result.UpdateResult;
import com.regulaone.backend.dto.Auth.LoginRequest;
import com.regulaone.backend.dto.Auth.LoginResponse;
import com.regulaone.backend.models.User;
import com.regulaone.backend.repository.SafeWorkEmployeeStubRepository;
import com.regulaone.backend.repository.UserRepository;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UserSafeWorkLoginRepairTest {

    @Test
    void successfulLoginRepairsMissingSafeWorkReference() {
        ObjectId userId = new ObjectId();
        User user = User.builder()
                .id(userId.toHexString())
                .email("account@example.com")
                .build();
        UserRepository userRepository = repositoryReturning(user);
        RecordingSafeWorkRepository safeWorkRepository = new RecordingSafeWorkRepository();
        UserService userService = new UserService(
                new SuccessfulCognitoService(),
                userRepository,
                null,
                null,
                null,
                null,
                safeWorkRepository);

        LoginRequest request = new LoginRequest();
        request.setEmail("account@example.com");
        request.setPassword("password");

        userService.login(request);

        assertEquals(userId, safeWorkRepository.provisionedUserId);
    }

    private static UserRepository repositoryReturning(User user) {
        return (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> {
                    if ("findByEmail".equals(method.getName())) {
                        return Optional.of(user);
                    }
                    throw new UnsupportedOperationException("Unexpected repository call: " + method.getName());
                });
    }

    private static final class SuccessfulCognitoService extends CognitoService {

        private SuccessfulCognitoService() {
            super("eu-central-1");
        }

        @Override
        public LoginResponse signIn(String email, String password) {
            return LoginResponse.builder().status("SUCCESS").build();
        }
    }

    private static final class RecordingSafeWorkRepository extends SafeWorkEmployeeStubRepository {

        private ObjectId provisionedUserId;

        private RecordingSafeWorkRepository() {
            super(null);
        }

        @Override
        public UpdateResult ensureExists(ObjectId userId) {
            provisionedUserId = userId;
            return UpdateResult.acknowledged(0, 0L, null);
        }
    }
}
