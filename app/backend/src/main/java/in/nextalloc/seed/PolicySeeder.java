package in.nextalloc.seed;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import in.nextalloc.domain.PolicyPreset;
import in.nextalloc.repo.PolicyPresetRepository;

/**
 * NextAlloc demonstration policies (illustrative, not official government
 * policy). Weights always sum to 100.
 */
@Configuration
public class PolicySeeder {

    @Bean
    public ApplicationRunner seedPolicies(PolicyPresetRepository presets) {
        return args -> seed(presets);
    }

    /**
     * Seeds default and demonstration policy presets idempotently.
     * Preserves existing v1 presets exactly as stored without modifying their
     * identity, version, weights, or names.
     */
    public void seed(PolicyPresetRepository presets) {
        // 1. Historical v1 presets (preserved exactly as defined originally)
        seedIfAbsent(presets, "balanced", "Balanced Allocation Policy",
                "NextAlloc default configurable weights that balance skill fit with preference and location.",
                "{\"skills\":35,\"qualification\":15,\"interest\":15,\"location\":10,\"preference\":10,\"learning\":10,\"experience\":5}",
                false, null, false, "v1");
        seedIfAbsent(presets, "skills", "Skills-Focused Policy",
                "Demonstration policy that prioritises technical skill fit over other factors.",
                "{\"skills\":50,\"qualification\":10,\"interest\":10,\"location\":10,\"preference\":10,\"learning\":5,\"experience\":5}",
                false, null, false, "v1");
        seedIfAbsent(presets, "preference", "Preference-Focused Policy",
                "Demonstration policy that gives candidates more control over where they are allocated.",
                "{\"skills\":25,\"qualification\":10,\"interest\":20,\"location\":10,\"preference\":25,\"learning\":5,\"experience\":5}",
                false, null, false, "v1");
        seedIfAbsent(presets, "equity", "Equity-Oriented Policy",
                "Demonstration policy that weighs location and learning potential more heavily to spread opportunities.",
                "{\"skills\":30,\"qualification\":15,\"interest\":10,\"location\":15,\"preference\":10,\"learning\":10,\"experience\":10}",
                false, null, false, "v1");
        seedIfAbsent(presets, "full_coverage", "Full Coverage (Demonstration)",
                "Demonstration policy with a hard rule that every eligible candidate must be allocated. "
                        + "Infeasible when demand exceeds available seats — used to show real solver infeasibility.",
                "{\"skills\":35,\"qualification\":15,\"interest\":15,\"location\":10,\"preference\":10,\"learning\":10,\"experience\":5}",
                true, null, false, "v1");

        // 2. New v2 demonstration policy targeting eligible rural candidates
        seedIfAbsent(presets, "balanced_v2", "Balanced Allocation Policy (v2)",
                "NextAlloc demonstration policy targeting eligible rural candidates with balanced scoring.",
                "{\"skills\":35,\"qualification\":15,\"interest\":15,\"location\":10,\"preference\":10,\"learning\":10,\"experience\":5}",
                false, null, true, "v2");
    }

    private void seedIfAbsent(PolicyPresetRepository presets, String key, String name, String description,
                              String weights, boolean fullCoverage, Integer floor, boolean isDefault, String version) {
        if (presets.findByKey(key).isEmpty()) {
            presets.save(preset(key, name, description, weights, fullCoverage, floor, isDefault, version));
        }
    }

    private PolicyPreset preset(String key, String name, String description, String weights,
                                boolean fullCoverage, Integer floor, boolean isDefault, String version) {
        PolicyPreset p = new PolicyPreset();
        p.key = key;
        p.name = name;
        p.description = description;
        p.weightsJson = weights;
        p.fullCoverage = fullCoverage;
        p.fairnessFloorPct = floor;
        p.isDefault = isDefault;
        p.version = version;
        return p;
    }
}
