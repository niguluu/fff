import React from "react";
import { Text } from "ink";

export function FillLines({ count, width }: { count: number; width: number }) {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Text key={i}>
          {" ".repeat(width)}
        </Text>
      ))}
    </>
  );
}

export function padToWidth(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}
