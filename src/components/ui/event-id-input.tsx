"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function EventIdInput() {
  const [eventId, setEventId] = useState('');

  const handleWatch = () => {
    if (eventId.trim()) {
      window.location.href = `/watch/${eventId.trim()}`;
    }
  };

  return (
    <div className="flex space-x-2">
      <input
        type="text"
        placeholder="イベントID"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleWatch()}
      />
      <Button
        size="sm"
        onClick={handleWatch}
      >
        視聴
      </Button>
    </div>
  );
}
