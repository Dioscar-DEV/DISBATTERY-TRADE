'use client'

import { useEffect, useMemo, useState } from 'react';
import { serviceWorkerManager } from '@/services/serviceWorkerManager';

interface ProgressState {
  total: number;
  done: number;
  percentage: number;
  message: string;
}

export default function AutoPrecacheOverlay() {
  return null;
}


