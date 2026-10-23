import { MetersScreen } from '@/features/extras/MetersScreen';
import { HomeScreen } from '@/features/home/HomeScreen';
import { SettingsScreen } from '@/features/home/SettingsScreen';
import { RoomScreen } from '@/features/rooms/RoomScreen';
import { RoomsScreen } from '@/features/rooms/RoomsScreen';
import { BasisScreen } from '@/features/setup/BasisScreen';
import { FinishScreen } from '@/features/sign/FinishScreen';
import { useRoute } from '@/router';
import { ProtocolProvider } from '@/storage/useProtocol';

export function App() {
  const route = useRoute();
  if (route.name === 'home') return <HomeScreen />;
  if (route.name === 'settings') return <SettingsScreen />;
  return (
    <ProtocolProvider key={route.id} id={route.id}>
      {route.name === 'basis' ? <BasisScreen id={route.id} focus={route.focus} /> : null}
      {route.name === 'rooms' ? <RoomsScreen id={route.id} /> : null}
      {route.name === 'room' ? (
        <RoomScreen id={route.id} roomId={route.roomId} checkId={route.checkId} />
      ) : null}
      {route.name === 'meters' ? <MetersScreen id={route.id} focus={route.focus} /> : null}
      {route.name === 'finish' ? <FinishScreen id={route.id} /> : null}
    </ProtocolProvider>
  );
}
