package in.nextalloc.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

/** OpenAPI documentation for judges and developers (technical surface). */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI nextallocOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("NextAlloc Allocation Platform API")
                        .description("REST API for NextAlloc — AI-Powered Internship Allocation Engine "
                                + "(SIH25033). All data in the demonstration environment is "
                                + "synthetic. Sign in at /api/auth/login to obtain a bearer token.")
                        .version("1.0.0")
                        .contact(new Contact().name("NextAlloc Team")))
                .components(new Components().addSecuritySchemes("bearer",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP)
                                .scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearer"));
    }
}
