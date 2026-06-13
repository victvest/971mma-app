import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/**
 * Dependency-free deterministic QR-style visual.
 * Renders a stable pseudo-random matrix from a seed plus the 3 finder squares,
 * so it looks like a real scannable code for the demo without a QR library.
 */
function seededMatrix(seed: string, size: number) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const grid: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(rand() > 0.52);
    grid.push(row);
  }
  return grid;
}

function inFinder(r: number, c: number, size: number) {
  const f = 7;
  const tl = r < f && c < f;
  const tr = r < f && c >= size - f;
  const bl = r >= size - f && c < f;
  return tl || tr || bl;
}

export function QrCode({ seed, size = 200 }: { seed: string; size?: number }) {
  const dims = 21;
  const grid = useMemo(() => seededMatrix(seed, dims), [seed]);
  const cell = size / dims;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((on, c) => {
            const finder = inFinder(r, c, dims);
            return (
              <View
                key={c}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: finder ? 'transparent' : on ? colors.text : 'transparent',
                }}
              />
            );
          })}
        </View>
      ))}
      <Finder style={{ top: 0, left: 0 }} cell={cell} />
      <Finder style={{ top: 0, right: 0 }} cell={cell} />
      <Finder style={{ bottom: 0, left: 0 }} cell={cell} />
    </View>
  );
}

function Finder({ style, cell }: { style: object; cell: number }) {
  const s = cell * 7;
  return (
    <View style={[styles.finder, { width: s, height: s, borderWidth: cell }, style]}>
      <View style={{ width: cell * 3, height: cell * 3, backgroundColor: colors.text }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', position: 'relative' },
  finder: {
    position: 'absolute',
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
