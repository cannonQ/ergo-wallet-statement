import React, { useState } from 'react';
import { Image, ExternalLink, Music, Video, Palette } from 'lucide-react';

interface NFT {
  tokenId: string;
  name: string;
  description: string;
  type: 'NFT' | 'Audio' | 'Video' | 'Artwork Collection';
}

interface NFTGalleryProps {
  nfts: NFT[];
  isLoading?: boolean;
}

// Ergo Auctions CDN caches NFT images by tokenId
const getArtworkUrl = (tokenId: string) =>
  `https://ergoauctions.org/api/v1/artworkUrl/${tokenId}`;

export const NFTGallery: React.FC<NFTGalleryProps> = ({ nfts, isLoading = false }) => {
  const [selectedType, setSelectedType] = useState<string>('All');
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const types = ['All', 'NFT', 'Audio', 'Video', 'Artwork Collection'];

  const openExplorer = (tokenId: string) => {
    window.open(`https://ergexplorer.com/token#${tokenId}`, '_blank');
  };

  const handleImageError = (tokenId: string) => {
    setFailedImages(prev => new Set(prev).add(tokenId));
  };

  const filteredNfts = selectedType === 'All'
    ? nfts
    : nfts.filter(nft => nft.type === selectedType);

  const getIcon = (type: NFT['type']) => {
    switch (type) {
      case 'Audio':
        return <Music className="w-8 h-8" />;
      case 'Video':
        return <Video className="w-8 h-8" />;
      case 'Artwork Collection':
        return <Palette className="w-8 h-8" />;
      default:
        return <Image className="w-8 h-8" />;
    }
  };

  const getTypeColor = (type: NFT['type']) => {
    switch (type) {
      case 'Audio':
        return 'bg-purple-600';
      case 'Video':
        return 'bg-red-600';
      case 'Artwork Collection':
        return 'bg-pink-600';
      default:
        return 'bg-blue-600';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <div className="flex items-center space-x-2 mb-4">
          <Image className="w-5 h-5 text-pink-400" />
          <h2 className="text-xl font-bold text-white">NFTs & Collectibles</h2>
        </div>
        <div className="text-gray-400 text-center py-8">
          Loading NFTs...
        </div>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <div className="flex items-center space-x-2 mb-4">
          <Image className="w-5 h-5 text-pink-400" />
          <h2 className="text-xl font-bold text-white">NFTs & Collectibles</h2>
        </div>
        <div className="text-gray-400 text-center py-8">
          <p>No NFTs found in this wallet</p>
          <p className="text-sm mt-2">NFTs are tokens with a quantity of 1 and no decimals</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Image className="w-5 h-5 text-pink-400" />
          <h2 className="text-xl font-bold text-white">NFTs & Collectibles</h2>
        </div>
        <span className="text-gray-400 text-sm">{filteredNfts.length} of {nfts.length} item{nfts.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {types.map((type) => (
          <button
            key={type}
            className={`px-3 py-1 rounded-lg text-sm ${
              selectedType === type
                ? 'bg-pink-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            onClick={() => setSelectedType(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredNfts.map((nft) => (
          <div
            key={nft.tokenId}
            className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer group"
            onClick={() => openExplorer(nft.tokenId)}
          >
            {/* Artwork image with fallback to placeholder */}
            <div className={`aspect-square ${getTypeColor(nft.type)} flex items-center justify-center text-white/80 relative overflow-hidden`}>
              {!failedImages.has(nft.tokenId) ? (
                <img
                  src={getArtworkUrl(nft.tokenId)}
                  alt={nft.name}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(nft.tokenId)}
                />
              ) : (
                getIcon(nft.type)
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-sm truncate" title={nft.name}>
                    {nft.name}
                  </h3>
                  <p className="text-gray-400 text-xs mt-1 line-clamp-2" title={nft.description}>
                    {nft.description}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
              </div>

              <div className="mt-2">
                <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(nft.type)} text-white`}>
                  {nft.type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
