import React, { useState } from 'react';
import { Search, Eye, EyeOff, Music, Video, Image, Palette } from 'lucide-react';
import type { Collectible } from '../types';

interface CollectiblesProps {
  collectibles: Collectible[];
}

export const Collectibles: React.FC<CollectiblesProps> = ({ collectibles }) => {
  const [showNSFW, setShowNSFW] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<Collectible['type']>('NFT');

  const categories: Collectible['type'][] = ['NFT', 'Audio', 'Video', 'Artwork Collection'];

  const getIcon = (type: Collectible['type']) => {
    switch (type) {
      case 'Audio':
        return <Music size={40} />;
      case 'Video':
        return <Video size={40} />;
      case 'NFT':
        return <Image size={40} />;
      case 'Artwork Collection':
        return <Palette size={40} />;
    }
  };

  const filteredCollectibles = collectibles
    .filter(item => 
      (showNSFW || !item.isNSFW) && 
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (selectedType === item.type)
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg mt-6">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-white">Collectibles</h2>
            <div className="flex space-x-2">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`px-4 py-2 rounded-lg ${
                    selectedType === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                  onClick={() => setSelectedType(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowNSFW(!showNSFW)}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                showNSFW ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {showNSFW ? <EyeOff size={18} className="mr-2" /> : <Eye size={18} className="mr-2" />}
              {showNSFW ? 'Hide NSFW' : 'Show NSFW'}
            </button>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search collectibles..."
                className="bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
        {filteredCollectibles.map((item) => (
          <div
            key={item.id}
            className="group relative bg-gray-800 rounded-lg overflow-hidden transition-transform hover:scale-105"
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full aspect-square object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-square bg-gray-700 flex items-center justify-center text-gray-400">
                {getIcon(item.type)}
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 transform translate-y-full group-hover:translate-y-0 transition-transform">
              <p className="text-sm text-white font-medium truncate">{item.name}</p>
              {item.metadata?.collection && (
                <p className="text-xs text-gray-300 truncate">{item.metadata.collection}</p>
              )}
              {(item.type === 'Audio' || item.type === 'Video') && item.metadata?.duration && (
                <p className="text-xs text-gray-400">{item.metadata.duration}</p>
              )}
            </div>
            
            {item.isNSFW && showNSFW && (
              <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                NSFW
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};