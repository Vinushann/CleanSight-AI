'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getApiBaseUrl } from '@/core/apiBase';
import type { HouseOption, SessionType, VisualizationPayload } from '@/core/iotTypes';

type DashboardDataContextValue = {
  houses: HouseOption[];
  rooms: string[];
  selectedHouseId: string;
  selectedRoomId: string;
  selectedSessionType: SessionType | 'all';
  selectedDate: string;
  selectedDateTo: string;
  appliedHouseId: string;
  appliedRoomId: string;
  appliedSessionType: SessionType | 'all';
  appliedDate: string;
  appliedDateTo: string;
  data: VisualizationPayload | null;
  loadingFilters: boolean;
  loadingData: boolean;
  error: string | null;
  setSelectedHouseId: (value: string) => void;
  setSelectedRoomId: (value: string) => void;
  setSelectedSessionType: (value: SessionType | 'all') => void;
  setSelectedDate: (value: string) => void;
  setSelectedDateTo: (value: string) => void;
  applyDateFilter: () => Promise<void>;
  applySearch: () => Promise<void>;
  refreshFilters: () => Promise<void>;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail || 'Request failed');
  }
  return payload as T;
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [houses, setHouses] = useState<HouseOption[]>([]);
  const [selectedHouseId, setSelectedHouseId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedSessionType, setSelectedSessionType] = useState<SessionType | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDateTo, setSelectedDateTo] = useState('');
  const [appliedHouseId, setAppliedHouseId] = useState('');
  const [appliedRoomId, setAppliedRoomId] = useState('');
  const [appliedSessionType, setAppliedSessionType] = useState<SessionType | 'all'>('all');
  const [appliedDate, setAppliedDate] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [data, setData] = useState<VisualizationPayload | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rooms = useMemo(() => {
    const selectedHouse = houses.find((house) => house.house_id === selectedHouseId);
    return selectedHouse?.rooms || [];
  }, [houses, selectedHouseId]);

  const refreshFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const query = new URLSearchParams();
      const from = selectedDate || selectedDateTo;
      const to = selectedDateTo || selectedDate;
      if (from) {
        query.set('date_from', from);
      }
      if (to) {
        query.set('date_to', to);
      }
      const querySuffix = query.toString() ? `?${query.toString()}` : '';
      const payload = await fetchJson<{ status: string; houses: HouseOption[] }>(
        `${apiBaseUrl}/api/v1/dashboard/filters${querySuffix}`
      );
      const fetchedHouses = payload.houses || [];
      setHouses(fetchedHouses);

      if (!fetchedHouses.length) {
        setSelectedHouseId('');
        setSelectedRoomId('');
        return;
      }

      const preferredHouseId = fetchedHouses.some((house) => house.house_id === selectedHouseId)
        ? selectedHouseId
        : fetchedHouses[0].house_id;

      const preferredHouse = fetchedHouses.find((house) => house.house_id === preferredHouseId);
      const preferredRooms = preferredHouse?.rooms || [];
      const preferredRoomId = preferredRooms.includes(selectedRoomId) ? selectedRoomId : (preferredRooms[0] || '');

      setSelectedHouseId(preferredHouseId);
      setSelectedRoomId(preferredRoomId);
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load filters.';
      setError(message);
    } finally {
      setLoadingFilters(false);
    }
  }, [apiBaseUrl, selectedDate, selectedDateTo, selectedHouseId, selectedRoomId]);

  useEffect(() => {
    void refreshFilters();
  }, [refreshFilters]);

  useEffect(() => {
    if (!selectedHouseId) {
      setSelectedRoomId('');
      return;
    }
    const selectedHouse = houses.find((house) => house.house_id === selectedHouseId);
    const nextRooms = selectedHouse?.rooms || [];
    if (!nextRooms.includes(selectedRoomId)) {
      setSelectedRoomId(nextRooms[0] || '');
    }
  }, [houses, selectedHouseId, selectedRoomId]);

  const applySearch = useCallback(async () => {
    if (!selectedHouseId || !selectedRoomId) {
      setError('Please choose a house and room before searching.');
      return;
    }

    setLoadingData(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        house_id: selectedHouseId,
        room_id: selectedRoomId,
      });
      if (selectedSessionType !== 'all') {
        query.set('session_type', selectedSessionType);
      }
      const from = selectedDate || selectedDateTo;
      const to = selectedDateTo || selectedDate;
      if (from) {
        query.set('date_from', from);
      }
      if (to) {
        query.set('date_to', to);
      }
      const payload = await fetchJson<VisualizationPayload>(
        `${apiBaseUrl}/api/v1/dashboard/visualization?${query.toString()}`
      );
      setData(payload);
      setAppliedHouseId(selectedHouseId);
      setAppliedRoomId(selectedRoomId);
      setAppliedSessionType(selectedSessionType);
      setAppliedDate(selectedDate);
      setAppliedDateTo(selectedDateTo);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load visualization data.';
      setError(message);
    } finally {
      setLoadingData(false);
    }
  }, [apiBaseUrl, selectedDate, selectedDateTo, selectedHouseId, selectedRoomId, selectedSessionType]);

  const applyDateFilter = useCallback(async () => {
    setData(null);
    setAppliedHouseId('');
    setAppliedRoomId('');
    setAppliedSessionType('all');
    setAppliedDate('');
    setAppliedDateTo('');
    await refreshFilters();
  }, [refreshFilters]);

  const value = useMemo<DashboardDataContextValue>(
    () => ({
      houses,
      rooms,
      selectedHouseId,
      selectedRoomId,
      selectedSessionType,
      selectedDate,
      selectedDateTo,
      appliedHouseId,
      appliedRoomId,
      appliedSessionType,
      appliedDate,
      appliedDateTo,
      data,
      loadingFilters,
      loadingData,
      error,
      setSelectedHouseId,
      setSelectedRoomId,
      setSelectedSessionType,
      setSelectedDate,
      setSelectedDateTo,
      applyDateFilter,
      applySearch,
      refreshFilters,
    }),
    [
      houses,
      rooms,
      selectedHouseId,
      selectedRoomId,
      selectedSessionType,
      selectedDate,
      selectedDateTo,
      appliedHouseId,
      appliedRoomId,
      appliedSessionType,
      appliedDate,
      appliedDateTo,
      data,
      loadingFilters,
      loadingData,
      error,
      applyDateFilter,
      applySearch,
      refreshFilters,
    ]
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error('useDashboardData must be used within DashboardDataProvider.');
  }
  return context;
}
