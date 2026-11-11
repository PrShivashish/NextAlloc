package in.nextalloc.service;

import java.util.Map;

import org.springframework.stereotype.Service;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.User;
import in.nextalloc.domain.enums.AuditAction;
import in.nextalloc.domain.enums.UserStatus;
import in.nextalloc.repo.UserRepository;
import in.nextalloc.security.AuthUser;
import in.nextalloc.security.JwtService;

import org.springframework.security.crypto.password.PasswordEncoder;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final AuditService audit;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtService jwt, AuditService audit) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.audit = audit;
    }

    public record LoginResult(String token, Map<String, Object> user) { }

    public LoginResult login(String email, String password) {
        String cleanEmail = email == null ? "" : email.trim().toLowerCase();
        User user = users.findByEmail(cleanEmail)
                .or(() -> cleanEmail.endsWith("@nextalloc.in")
                        ? users.findByEmail(cleanEmail.replace("@nextalloc.in", "@pragati.gov.in"))
                        : cleanEmail.endsWith("@pragati.gov.in")
                                ? users.findByEmail(cleanEmail.replace("@pragati.gov.in", "@nextalloc.in"))
                                : java.util.Optional.empty())
                .orElseThrow(() -> ApiException.badRequest("Incorrect email or password."));
        if (user.status != UserStatus.ACTIVE) {
            throw ApiException.forbidden("This account is disabled. Contact an administrator.");
        }
        if (!encoder.matches(password, user.passwordHash)) {
            throw ApiException.badRequest("Incorrect email or password.");
        }
        String token = jwt.issue(user.id, user.email, user.name, user.role.name());
        audit.log(new AuthUser(user.id, user.email, user.name, user.role.name()),
                AuditAction.LOGIN, "User", String.valueOf(user.id),
                user.name + " signed in as " + in.nextalloc.common.Labels.label(user.role), null);
        return new LoginResult(token, Map.of(
                "id", user.id, "email", user.email, "name", user.name, "role", user.role.name()));
    }
}
