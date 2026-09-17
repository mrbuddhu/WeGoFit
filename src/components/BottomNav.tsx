import { Home, Utensils, Dumbbell, MessageCircle, User, LucideIcon } from 'lucide-react';
import { NavTab } from '../types';

interface Props {
  active: NavTab;
  onChange: (tab: NavTab) => void;
}

const TABS: { id: NavTab; label: string; Icon: LucideIcon }[] = [
  { id: 'home',      label: 'Home',      Icon: Home },
  { id: 'nutrition', label: 'Nutrition', Icon: Utensils },
  { id: 'train',     label: 'Train',     Icon: Dumbbell },
  { id: 'coach',     label: 'Coach',     Icon: MessageCircle },
  { id: 'profile',   label: 'Profile',   Icon: User },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 px-1 pb-safe"
      style={{
        background: 'linear-gradient(to top, rgba(13,27,42,0.98) 0%, rgba(13,27,42,0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      }}
    >
      <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="nav-tab min-w-0 flex-1 transition-all duration-200"
              style={{ color: isActive ? '#F97316' : 'rgba(255,255,255,0.4)' }}
            >
              <div className="relative">
                <Icon
                  size={20}
                  className={`transition-all duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}
                />
                {isActive && (
                  <div
                    className="absolute -inset-1.5 rounded-xl -z-10"
                    style={{ backgroundColor: 'rgba(249,115,22,0.15)', animation: 'fadeIn 0.2s ease-out' }}
                  />
                )}
              </div>
              <span className="text-xs font-medium transition-all duration-200">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
