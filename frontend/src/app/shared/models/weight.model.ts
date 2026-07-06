export interface WeightEntry {
  date: string;      // "yyyy-MM-dd"
  weightKg: number;
}

export interface WeightHistory {
  entries: WeightEntry[];
  goalKg: number | null;
}
