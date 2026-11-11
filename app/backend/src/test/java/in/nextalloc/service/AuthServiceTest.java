package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.User;
import in.nextalloc.domain.enums.Role;
import in.nextalloc.domain.enums.UserStatus;
import in.nextalloc.repo.UserRepository;
import in.nextalloc.security.JwtService;

class AuthServiceTest {

    private UserRepository users;
    private PasswordEncoder encoder;
    private JwtService jwt;
    private AuditService audit;
    private AuthService auth;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        encoder = mock(PasswordEncoder.class);
        jwt = mock(JwtService.class);
        audit = mock(AuditService.class);
        auth = new AuthService(users, encoder, jwt, audit);
    }

    @Test
    void loginWithDirectEmail() {
        User u = new User();
        u.id = 1L;
        u.email = "admin@pragati.gov.in";
        u.name = "Shivashish Prusty";
        u.role = Role.ADMIN;
        u.status = UserStatus.ACTIVE;
        u.passwordHash = "hash123";

        when(users.findByEmail("admin@pragati.gov.in")).thenReturn(Optional.of(u));
        when(encoder.matches("Admin@123", "hash123")).thenReturn(true);
        when(jwt.issue(1L, "admin@pragati.gov.in", "Shivashish Prusty", "ADMIN")).thenReturn("fake-jwt-token");

        AuthService.LoginResult res = auth.login("admin@pragati.gov.in", "Admin@123");
        assertNotNull(res);
        assertEquals("fake-jwt-token", res.token());
        assertEquals("Shivashish Prusty", res.user().get("name"));
    }

    @Test
    void loginWithNextAllocRebrandAlias() {
        User u = new User();
        u.id = 1L;
        u.email = "admin@pragati.gov.in";
        u.name = "Shivashish Prusty";
        u.role = Role.ADMIN;
        u.status = UserStatus.ACTIVE;
        u.passwordHash = "hash123";

        when(users.findByEmail("admin@nextalloc.in")).thenReturn(Optional.empty());
        when(users.findByEmail("admin@pragati.gov.in")).thenReturn(Optional.of(u));
        when(encoder.matches("Admin@123", "hash123")).thenReturn(true);
        when(jwt.issue(1L, "admin@pragati.gov.in", "Shivashish Prusty", "ADMIN")).thenReturn("fake-jwt-token");

        AuthService.LoginResult res = auth.login("admin@nextalloc.in", "Admin@123");
        assertNotNull(res);
        assertEquals("fake-jwt-token", res.token());
        assertEquals("Shivashish Prusty", res.user().get("name"));
    }

    @Test
    void loginWithBadPasswordThrows() {
        User u = new User();
        u.id = 1L;
        u.email = "admin@nextalloc.in";
        u.name = "Shivashish Prusty";
        u.role = Role.ADMIN;
        u.status = UserStatus.ACTIVE;
        u.passwordHash = "hash123";

        when(users.findByEmail("admin@nextalloc.in")).thenReturn(Optional.of(u));
        when(encoder.matches("WrongPass", "hash123")).thenReturn(false);

        assertThrows(ApiException.class, () -> auth.login("admin@nextalloc.in", "WrongPass"));
    }

    @Test
    void loginWithInactiveAccountThrows() {
        User u = new User();
        u.id = 1L;
        u.email = "admin@nextalloc.in";
        u.name = "Shivashish Prusty";
        u.role = Role.ADMIN;
        u.status = UserStatus.DISABLED;
        u.passwordHash = "hash123";

        when(users.findByEmail("admin@nextalloc.in")).thenReturn(Optional.of(u));

        assertThrows(ApiException.class, () -> auth.login("admin@nextalloc.in", "Admin@123"));
    }
}
