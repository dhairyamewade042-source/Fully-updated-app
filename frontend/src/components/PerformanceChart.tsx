// Clean dual-line performance chart (Sales ₹ + Quantity kg) with tap tooltips.
// Pure presentational component — aggregation happens on the dashboard.

import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import { useApp } from "@/src/context/AppContext";
import { kg, money } from "@/src/lib/format";
import { fontSize, radius, spacing } from "@/src/lib/theme";

export type ChartPoint = {
  key: string;
  x: string; // axis label
  tip: string; // tooltip date/time label
  sales: number;
  qty: number;
};

const SALES_COLOR = "#22C55E";
const QTY_COLOR = "#3B82F6";

const niceCeil = (v: number): number => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
};

const compactMoney = (n: number): string => {
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1) + "Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(n % 100000 === 0 ? 0 : 1) + "L";
  if (n >= 1000) return "₹" + Math.round(n / 1000) + "k";
  return "₹" + Math.round(n);
};

const compactKg = (n: number): string =>
  n >= 1000 ? (n / 1000).toFixed(1) + "t" : String(Math.round(n));

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const PerformanceChart = ({
  points,
  currency,
}: {
  points: ChartPoint[];
  currency: string;
}) => {
  const { theme } = useApp();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    setActive(null);
  }, [points]);

  const n = points.length;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const H = 240;
  const padTop = 16;
  const padBottom = 26;
  const padLeft = 50;
  const padRight = 44;

  if (n === 0) {
    return (
      <View>
        <Legend theme={theme} />
        <View
          onLayout={onLayout}
          style={[styles.plot, { height: H, borderColor: theme.border }]}
        >
          <View style={styles.emptyWrap}>
            <Text style={{ color: theme.muted, fontSize: fontSize.md }} testID="chart-empty">
              No sales in this period
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const activeIdx = active == null ? n - 1 : clamp(active, 0, n - 1);

  const salesMax = niceCeil(Math.max(1, ...points.map((p) => p.sales)));
  const qtyMax = niceCeil(Math.max(1, ...points.map((p) => p.qty)));

  const plotW = Math.max(0, width - padLeft - padRight);
  const plotH = H - padTop - padBottom;

  const xFor = (i: number) =>
    n <= 1 ? padLeft + plotW / 2 : padLeft + (i / (n - 1)) * plotW;
  const ySales = (v: number) => padTop + plotH - (v / salesMax) * plotH;
  const yQty = (v: number) => padTop + plotH - (v / qtyMax) * plotH;

  const salesPts = points.map((p, i) => `${xFor(i)},${ySales(p.sales)}`).join(" ");
  const qtyPts = points.map((p, i) => `${xFor(i)},${yQty(p.qty)}`).join(" ");

  const gridVals = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = n <= 7 ? 1 : Math.ceil(n / 6);
  const colW = n <= 1 ? plotW : Math.max(20, plotW / (n - 1));

  const ap = points[activeIdx];
  const tipW = 150;
  const tipLeft = clamp(xFor(activeIdx) - tipW / 2, padLeft - 8, width - tipW - 4);

  return (
    <View>
      <Legend theme={theme} />
      <View
        onLayout={onLayout}
        style={[styles.plot, { height: H, borderColor: theme.border }]}
      >
        {width > 0 ? (
          <>
            <Svg width={width} height={H}>
              {gridVals.map((g, i) => {
                const y = padTop + plotH * (1 - g);
                return (
                  <Line
                    key={`grid-${i}`}
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + plotW}
                    y2={y}
                    stroke={theme.border}
                    strokeWidth={1}
                  />
                );
              })}
              {/* active vertical guide */}
              <Line
                x1={xFor(activeIdx)}
                y1={padTop}
                x2={xFor(activeIdx)}
                y2={padTop + plotH}
                stroke={theme.borderStrong}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <Polyline
                points={qtyPts}
                fill="none"
                stroke={QTY_COLOR}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Polyline
                points={salesPts}
                fill="none"
                stroke={SALES_COLOR}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((p, i) => (
                <Circle
                  key={`qd-${p.key}`}
                  cx={xFor(i)}
                  cy={yQty(p.qty)}
                  r={i === activeIdx ? 5 : 3}
                  fill={QTY_COLOR}
                  stroke={theme.surfaceSecondary}
                  strokeWidth={i === activeIdx ? 2 : 0}
                />
              ))}
              {points.map((p, i) => (
                <Circle
                  key={`sd-${p.key}`}
                  cx={xFor(i)}
                  cy={ySales(p.sales)}
                  r={i === activeIdx ? 5 : 3}
                  fill={SALES_COLOR}
                  stroke={theme.surfaceSecondary}
                  strokeWidth={i === activeIdx ? 2 : 0}
                />
              ))}
            </Svg>

            {/* Left ₹ axis labels */}
            {gridVals.map((g, i) => (
              <Text
                key={`ly-${i}`}
                style={{
                  position: "absolute",
                  left: 2,
                  width: padLeft - 6,
                  textAlign: "right",
                  top: padTop + plotH * (1 - g) - 7,
                  color: theme.muted,
                  fontSize: 10,
                }}
              >
                {compactMoney(salesMax * g)}
              </Text>
            ))}

            {/* Right kg axis labels */}
            {gridVals.map((g, i) => (
              <Text
                key={`ry-${i}`}
                style={{
                  position: "absolute",
                  right: 2,
                  width: padRight - 6,
                  textAlign: "left",
                  top: padTop + plotH * (1 - g) - 7,
                  color: theme.muted,
                  fontSize: 10,
                }}
              >
                {compactKg(qtyMax * g)}
              </Text>
            ))}

            {/* X axis labels */}
            {points.map((p, i) =>
              i % labelStep === 0 || i === n - 1 ? (
                <Text
                  key={`lx-${p.key}`}
                  numberOfLines={1}
                  style={{
                    position: "absolute",
                    top: padTop + plotH + 6,
                    left: xFor(i) - 26,
                    width: 52,
                    textAlign: "center",
                    color: theme.muted,
                    fontSize: 10,
                  }}
                >
                  {p.x}
                </Text>
              ) : null,
            )}

            {/* Tap columns */}
            {points.map((p, i) => (
              <Pressable
                key={`tap-${p.key}`}
                testID={`chart-point-${i}`}
                onPress={() => setActive(i)}
                style={{
                  position: "absolute",
                  top: 0,
                  height: H,
                  left: clamp(xFor(i) - colW / 2, 0, Math.max(0, width - colW)),
                  width: colW,
                }}
              />
            ))}

            {/* Tooltip */}
            <View
              testID="chart-tooltip"
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 4,
                left: tipLeft,
                width: tipW,
                backgroundColor: theme.surfaceSecondary,
                borderColor: theme.borderStrong,
                borderWidth: 1,
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.sm,
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 4,
              }}
            >
              <Text
                style={{ color: theme.onSurface, fontSize: fontSize.sm, fontWeight: "800" }}
                testID="chart-tooltip-label"
              >
                {ap.tip}
              </Text>
              <View style={styles.tipRow}>
                <View style={[styles.dot, { backgroundColor: SALES_COLOR }]} />
                <Text style={{ color: theme.muted, fontSize: fontSize.xs }}>Sales: </Text>
                <Text style={{ color: theme.onSurface, fontSize: fontSize.xs, fontWeight: "700" }}>
                  {money(ap.sales, currency)}
                </Text>
              </View>
              <View style={styles.tipRow}>
                <View style={[styles.dot, { backgroundColor: QTY_COLOR }]} />
                <Text style={{ color: theme.muted, fontSize: fontSize.xs }}>Qty: </Text>
                <Text style={{ color: theme.onSurface, fontSize: fontSize.xs, fontWeight: "700" }}>
                  {kg(ap.qty)}
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
};

const Legend = ({ theme }: { theme: any }) => (
  <View style={styles.legend}>
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: SALES_COLOR }]} />
      <Text style={{ color: theme.onSurface, fontSize: fontSize.sm, fontWeight: "700" }}>
        Sales (₹)
      </Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: QTY_COLOR }]} />
      <Text style={{ color: theme.onSurface, fontSize: fontSize.sm, fontWeight: "700" }}>
        Quantity (kg)
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  plot: {
    marginTop: spacing.sm,
    position: "relative",
    borderRadius: radius.md,
  },
  emptyWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    flexDirection: "row",
    gap: spacing.lg,
    alignItems: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
