import React from 'react';
import { BarChart3, Wallet, TrendingUp, Activity, Calendar, List, Gamepad2, Image } from 'lucide-react';

interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface SectionWithMobileLabel extends Section {
  mobileLabel?: string;
}

const sections: SectionWithMobileLabel[] = [
  { id: 'chart', label: 'Chart', icon: <BarChart3 size={14} /> },
  { id: 'summary', label: 'Summary', icon: <Wallet size={14} /> },
  { id: 'holdings', label: 'Holdings', icon: <TrendingUp size={14} /> },
  { id: 'heatmap', label: 'Activity', icon: <Calendar size={14} /> },
  { id: 'transactions', label: 'Transactions', mobileLabel: 'TXs', icon: <List size={14} /> },
  { id: 'cyberverse', label: 'CyberVerse', icon: <Gamepad2 size={14} /> },
  { id: 'nfts', label: 'NFTs', icon: <Image size={14} /> },
];

export const SectionNav: React.FC = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -80; // Offset for sticky navbar
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-[52px] md:top-[60px] z-40 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 px-2 sm:px-4 py-2">
      <div className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded text-xs sm:text-sm whitespace-nowrap transition-colors flex-shrink-0"
          >
            <span className="hidden sm:inline">{section.icon}</span>
            <span className="sm:hidden">{section.mobileLabel || section.label}</span>
            <span className="hidden sm:inline">{section.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
