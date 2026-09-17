import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Rect, Polyline, Text as SvgText } from "react-native-svg";
import { SW, C } from "../lib/constants";

export function RouteMap({ positions, height = 200 }) {
  if (positions.length === 0) {
    return (
      <View style={{ height, backgroundColor: C.cardLight, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.greyDim, fontSize: 13 }}>Waiting for GPS...</Text>
      </View>
    );
  }

  const W = SW - 32 - 32; // padding
  const PAD = 20;
  const lats = positions.map(p => p.lat);
  const lngs = positions.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.0001;
  const lngSpan = maxLng - minLng || 0.0001;
  const scaleX = (W - PAD * 2) / lngSpan;
  const scaleY = (height - PAD * 2) / latSpan;
  const scale = Math.min(scaleX, scaleY);

  const toX = lng => PAD + (W - PAD * 2 - lngSpan * scale) / 2 + (lng - minLng) * scale;
  const toY = lat => PAD + (height - PAD * 2 - latSpan * scale) / 2 + (maxLat - lat) * scale;

  const points = positions.map(p => `${toX(p.lng)},${toY(p.lat)}`).join(" ");
  const last = positions[positions.length - 1];
  const first = positions[0];

  return (
    <View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: C.cardLight }}>
      <Svg width={W} height={height}>
        <Rect width={W} height={height} fill={C.cardLight} />
        {positions.length >= 2 && (
          <Polyline points={points} fill="none" stroke={C.green} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* Start dot */}
        <Circle cx={toX(first.lng)} cy={toY(first.lat)} r={6} fill={C.white} />
        <SvgText x={toX(first.lng)} y={toY(first.lat) + 4} textAnchor="middle" fill={C.bg} fontSize={7} fontWeight="bold">S</SvgText>
        {/* Current dot */}
        <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={8} fill={C.green} opacity={0.25} />
        <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={5} fill={C.green} />
        <Circle cx={toX(last.lng)} cy={toY(last.lat)} r={2} fill={C.white} />
      </Svg>
    </View>
  );
}
