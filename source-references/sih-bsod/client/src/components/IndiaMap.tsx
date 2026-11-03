import { useState } from "react";
import { SVGMap } from "react-svg-map";
import India from "@svg-maps/india";
import "react-svg-map/lib/index.css";
import { motion } from "framer-motion";

interface StateStats {
  name: string;
  internships: number;
  companies: number;
  tier: string;
}

// State statistics data - keys match @svg-maps/india location IDs
const STATE_DATA: Record<string, StateStats> = {
  "ap": { name: "Andhra Pradesh", internships: 4200, companies: 295, tier: "Tier3" },
  "ar": { name: "Arunachal Pradesh", internships: 250, companies: 15, tier: "Tier3" },
  "as": { name: "Assam", internships: 850, companies: 55, tier: "Tier3" },
  "br": { name: "Bihar", internships: 2100, companies: 145, tier: "Tier3" },
  "ct": { name: "Chhattisgarh", internships: 1500, companies: 98, tier: "Tier3" },
  "ga": { name: "Goa", internships: 680, companies: 55, tier: "Tier2" },
  "gj": { name: "Gujarat", internships: 6200, companies: 420, tier: "Tier2" },
  "hr": { name: "Haryana", internships: 3200, companies: 210, tier: "Tier2" },
  "hp": { name: "Himachal Pradesh", internships: 680, companies: 42, tier: "Tier3" },
  "jh": { name: "Jharkhand", internships: 1800, companies: 125, tier: "Tier3" },
  "ka": { name: "Karnataka", internships: 16500, companies: 950, tier: "Tier1" },
  "kl": { name: "Kerala", internships: 3800, companies: 265, tier: "Tier2" },
  "mp": { name: "Madhya Pradesh", internships: 4500, companies: 285, tier: "Tier3" },
  "mh": { name: "Maharashtra", internships: 18000, companies: 1200, tier: "Tier1" },
  "mn": { name: "Manipur", internships: 180, companies: 12, tier: "Tier3" },
  "ml": { name: "Meghalaya", internships: 220, companies: 15, tier: "Tier3" },
  "mz": { name: "Mizoram", internships: 150, companies: 10, tier: "Tier3" },
  "nl": { name: "Nagaland", internships: 180, companies: 12, tier: "Tier3" },
  "or": { name: "Odisha", internships: 2400, companies: 165, tier: "Tier3" },
  "pb": { name: "Punjab", internships: 2500, companies: 180, tier: "Tier3" },
  "rj": { name: "Rajasthan", internships: 3800, companies: 245, tier: "Tier3" },
  "sk": { name: "Sikkim", internships: 120, companies: 8, tier: "Tier3" },
  "tn": { name: "Tamil Nadu", internships: 8200, companies: 580, tier: "Tier1" },
  "tg": { name: "Telangana", internships: 9500, companies: 680, tier: "Tier2" },
  "tr": { name: "Tripura", internships: 180, companies: 12, tier: "Tier3" },
  "up": { name: "Uttar Pradesh", internships: 8500, companies: 520, tier: "Tier3" },
  "ut": { name: "Uttarakhand", internships: 890, companies: 65, tier: "Tier3" },
  "wb": { name: "West Bengal", internships: 5500, companies: 380, tier: "Tier2" },
  "dl": { name: "Delhi NCR", internships: 12500, companies: 850, tier: "Tier1" },
  "jk": { name: "Jammu & Kashmir", internships: 450, companies: 25, tier: "Tier3" },
  "an": { name: "Andaman & Nicobar", internships: 50, companies: 5, tier: "Tier3" },
  "ch": { name: "Chandigarh", internships: 650, companies: 45, tier: "Tier2" },
  "dd": { name: "Daman & Diu", internships: 80, companies: 8, tier: "Tier3" },
  "dn": { name: "Dadra & Nagar Haveli", internships: 40, companies: 5, tier: "Tier3" },
  "ld": { name: "Lakshadweep", internships: 20, companies: 2, tier: "Tier3" },
  "py": { name: "Puducherry", internships: 350, companies: 25, tier: "Tier3" },
};

// Get fill color based on tier and internship count
function getStateColor(stateId: string): string {
  const data = STATE_DATA[stateId];
  if (!data) return "#e5e7eb";

  if (data.tier === "Tier1") {
    return data.internships > 15000 ? "#f97316" : "#fb923c";
  } else if (data.tier === "Tier2") {
    return data.internships > 5000 ? "#22c55e" : "#4ade80";
  } else {
    return data.internships > 2000 ? "#3b82f6" : "#60a5fa";
  }
}

export function IndiaMap() {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const totalInternships = Object.values(STATE_DATA).reduce((sum, s) => sum + s.internships, 0);
  const totalCompanies = Object.values(STATE_DATA).reduce((sum, s) => sum + s.companies, 0);

  const handleLocationMouseOver = (event: React.MouseEvent) => {
    const stateId = (event.target as SVGPathElement).getAttribute("id") || "";
    setHoveredState(stateId);
  };

  const handleLocationMouseMove = (event: React.MouseEvent) => {
    setTooltipPos({ x: event.clientX, y: event.clientY });
  };

  const handleLocationMouseOut = () => {
    setHoveredState(null);
  };

  const hoveredData = hoveredState ? STATE_DATA[hoveredState] : null;

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Header Stats */}
      <div className="flex justify-center gap-8 mb-6">
        <motion.div
          className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-3xl font-bold text-primary">{totalInternships.toLocaleString()}+</p>
          <p className="text-sm text-muted-foreground">Total Internships</p>
        </motion.div>
        <motion.div
          className="text-center p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-3xl font-bold text-green-500">{totalCompanies.toLocaleString()}+</p>
          <p className="text-sm text-muted-foreground">Partner Companies</p>
        </motion.div>
        <motion.div
          className="text-center p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-3xl font-bold text-orange-500">36</p>
          <p className="text-sm text-muted-foreground">States & UTs</p>
        </motion.div>
      </div>

      {/* Map Container */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        onMouseMove={(event: React.MouseEvent) => {
          if (hoveredState) {
            setTooltipPos({ x: event.clientX + 15, y: event.clientY - 10 });
          }
        }}
      >
        <style>{`
          .svg-map {
            width: 100%;
            height: auto;
            stroke: #fff;
            stroke-width: 0.5;
          }
          .svg-map__location {
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .svg-map__location:hover {
            stroke-width: 2;
            filter: brightness(1.1);
          }
          .svg-map__location:focus {
            outline: none;
          }
        `}</style>

        <SVGMap
          map={India}
          onLocationMouseOver={(event: React.MouseEvent) => {
            const stateId = (event.target as SVGPathElement).getAttribute("id") || "";
            setHoveredState(stateId);
            setTooltipPos({ x: event.clientX + 15, y: event.clientY - 10 });
          }}
          onLocationMouseOut={handleLocationMouseOut}
          locationClassName="svg-map__location"
          childrenBefore={(
            <defs>
              <filter id="mapShadow">
                <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.15" />
              </filter>
            </defs>
          )}
          locationTabIndex={null as any}
          className="svg-map"
          style={{ filter: "drop-shadow(0 10px 30px rgba(0, 0, 0, 0.1))" }}
          locationAriaLabel={(location: { id: string; name?: string }) => {
            const data = STATE_DATA[location.id];
            return data ? `${data.name}: ${data.internships} internships` : location.name;
          }}
        />

        {/* Apply colors via style injection */}
        <style>{`
          ${Object.keys(STATE_DATA).map(stateId => `
            .svg-map__location[id="${stateId}"] {
              fill: ${getStateColor(stateId)};
              fill-opacity: ${hoveredState === stateId ? 1 : 0.85};
            }
          `).join('')}
        `}</style>
      </motion.div>

      {/* Tooltip */}
      {hoveredData && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltipPos.x + 15,
            top: tooltipPos.y - 10,
          }}
        >
          <div className="bg-popover border rounded-xl shadow-xl p-4 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getStateColor(hoveredState!) }}
              />
              <h4 className="font-bold text-foreground">{hoveredData.name}</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Internships</span>
                <span className="font-semibold text-primary">
                  {hoveredData.internships.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Companies</span>
                <span className="font-semibold text-green-500">
                  {hoveredData.companies.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tier</span>
                <span className={`font-semibold ${hoveredData.tier === "Tier1" ? "text-orange-500" :
                  hoveredData.tier === "Tier2" ? "text-green-500" : "text-blue-500"
                  }`}>
                  {hoveredData.tier}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: getStateColor(hoveredState!) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((hoveredData.internships / 18000) * 100, 100)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        {[
          { label: "Tier 1 - Metro Hubs", color: "#fb923c", examples: "MH, KA, DL, TN" },
          { label: "Tier 2 - Growing", color: "#4ade80", examples: "GJ, TG, WB, HR" },
          { label: "Tier 3 - Emerging", color: "#60a5fa", examples: "UP, RJ, MP, etc." },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-xl text-sm"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <div>
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground ml-2">({item.examples})</span>
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        🇮🇳 PM Internship Scheme covers all States and Union Territories of India
      </p>
    </div>
  );
}
