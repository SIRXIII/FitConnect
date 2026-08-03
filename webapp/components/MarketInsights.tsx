import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { name: 'Standard Gym', price: 100 },
  { name: 'Private Studio', price: 120 },
  { name: 'Online Coach', price: 80 },
  { name: 'FitConnect', price: 50 },
];

const MarketInsights: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Price Comparison</h3>
        <p className="text-gray-500 mt-2">Average hourly rates in your area</p>
      </div>
      
      <div className="flex-grow min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip 
              cursor={{ fill: '#F3F4F6' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
            />
            <Bar dataKey="price" radius={[8, 8, 0, 0]} barSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.name === 'FitConnect' ? '#F87171' : '#E5E7EB'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-100">
        <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-full shadow-sm text-red-500">📉</div>
            <div>
                <p className="text-sm font-semibold text-gray-800">You Save Big</p>
                <p className="text-xs text-gray-600">Save up to $70 per session compared to private studios.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MarketInsights;