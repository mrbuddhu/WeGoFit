import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://yswkyjfsxsbmshliphet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzd2t5amZzeHNibXNobGlwaGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTQxMTksImV4cCI6MjA5NDE5MDExOX0.fo_Eq_6c3jk8Ws02TJLxNWX3qHSD2otu3ZvdQBVeD1Y';

export interface NutritionResult {
  query: string;
  foodName: string;
  servingDescription: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export async function fetchNutrition(foodQuery: string): Promise<NutritionResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? SUPABASE_ANON_KEY;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ mode: 'nutrition', foodQuery }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error === 'QUOTA_EXCEEDED') throw new Error('QUOTA_EXCEEDED');
    if (err.error === 'FOOD_NOT_FOUND') throw new Error('FOOD_NOT_FOUND');
    if (err.error === 'PARSE_ERROR') throw new Error('PARSE_ERROR');
    throw new Error('API_ERROR');
  }

  return await res.json() as NutritionResult;
}
