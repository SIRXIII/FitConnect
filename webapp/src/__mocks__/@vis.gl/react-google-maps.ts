import React from 'react';

export const APIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement('div', { 'data-testid': 'mock-api-provider' }, children);

export const Map: React.FC<{ children?: React.ReactNode; [key: string]: unknown }> = ({ children, ...props }) =>
  React.createElement('div', { 'data-testid': 'mock-map', ...props }, children);

export const AdvancedMarker: React.FC<{
  position?: { lat: number; lng: number };
  onClick?: () => void;
  draggable?: boolean;
  onDragEnd?: (e: unknown) => void;
  children?: React.ReactNode;
  [key: string]: unknown;
}> = ({ children, ...props }) =>
  React.createElement('div', { 'data-testid': 'mock-advanced-marker', ...props }, children);

export const useMap = () => null;
export const useMapsLibrary = () => null;
