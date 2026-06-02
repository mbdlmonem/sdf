import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(val: number | string | undefined) {
  if (val === undefined) return "$0.00";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "$0.00";
  
  if (num < 0.00001) return "$" + num.toFixed(10).replace(/\.?0+$/, "");
  if (num < 1) return "$" + num.toFixed(6);
  if (num >= 1000000000) return "$" + (num / 1000000000).toFixed(2) + "B";
  if (num >= 1000000) return "$" + (num / 1000000).toFixed(2) + "M";
  if (num >= 1000) return "$" + (num / 1000).toFixed(1) + "K";
  
  return "$" + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumber(val: number | undefined) {
  if (val === undefined) return "0";
  if (val >= 1000000000) return (val / 1000000000).toFixed(2) + "B";
  if (val >= 1000000) return (val / 1000000).toFixed(2) + "M";
  if (val >= 1000) return (val / 1000).toFixed(1) + "K";
  return val.toLocaleString();
}
