import type { ReactNode } from 'react';

import IoTNotifications from '@/components/iot/IoTNotifications';
import IoTSubNav from '@/components/iot/IoTSubNav';
import { IoTZenModeProvider } from '@/components/iot/IoTZenModeContext';
import ZenSessionOverlay from '@/components/iot/ZenSessionOverlay';

export default function IoTLayout({ children }: { children: ReactNode }) {
  return (
    <IoTZenModeProvider>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <IoTSubNav />
          </div>
          <IoTNotifications />
        </div>
        <ZenSessionOverlay />
        {children}
      </div>
    </IoTZenModeProvider>
  );
}
