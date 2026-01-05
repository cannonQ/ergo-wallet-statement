import React, { useState, useMemo } from 'react';
import { Gamepad2, ExternalLink, ChevronLeft, ChevronRight, Image } from 'lucide-react';

const PAGE_SIZE = 20;

interface NFT {
  tokenId: string;
  name: string;
  description: string;
  type: 'NFT' | 'Audio' | 'Video' | 'Artwork Collection';
  artworkUrl: string | null;
}

type CyberVerseCategory = 'All' | 'Gen2' | 'Gen3' | 'Car' | 'Apartment' | 'Pet' | 'Skins' | 'VIPCard' | 'Emote' | 'Audio' | 'JackHammer' | 'Egg';

interface CyberVerseSets {
  gen2: Set<string>;
  gen3: Set<string>;
  cars: Set<string>;
  apartments: Set<string>;
  pets: Set<string>;
  skins: Set<string>;
  vipcards: Set<string>;
  emotes: Set<string>;
  audio: Set<string>;
  jackhammers: Set<string>;
  eggs: Set<string>;
}

interface CyberVerseGalleryProps {
  nfts: NFT[];
  cyberverseSets: CyberVerseSets | null;
  isLoading?: boolean;
}

// Category display labels
const categoryLabels: Record<CyberVerseCategory, string> = {
  All: 'All',
  Gen2: 'Gen 2',
  Gen3: 'Gen 3',
  Car: 'Cars',
  Apartment: 'Apartments',
  Pet: 'Pets',
  Skins: 'Skins',
  VIPCard: 'VIP Cards',
  Emote: 'Emotes',
  Audio: 'Audio',
  JackHammer: 'JackHammers',
  Egg: 'Eggs',
};

export const CyberVerseGallery: React.FC<CyberVerseGalleryProps> = ({
  nfts,
  cyberverseSets,
  isLoading = false
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CyberVerseCategory>('All');
  const [page, setPage] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const categories: CyberVerseCategory[] = ['All', 'Gen2', 'Gen3', 'Car', 'Apartment', 'Pet', 'Skins', 'VIPCard', 'Emote', 'Audio', 'JackHammer', 'Egg'];

  const openExplorer = (tokenId: string) => {
    window.open(`https://ergexplorer.com/token#${tokenId}`, '_blank');
  };

  const handleImageError = (tokenId: string) => {
    setFailedImages(prev => new Set(prev).add(tokenId));
  };

  const getImageUrl = (nft: NFT): string | null => {
    if (failedImages.has(nft.tokenId)) {
      return null;
    }
    return nft.artworkUrl || null;
  };

  // Categorize a token and return its category or null if not CyberVerse
  const categorizeToken = (tokenId: string): CyberVerseCategory | null => {
    if (!cyberverseSets) return null;

    if (cyberverseSets.gen2.has(tokenId)) return 'Gen2';
    if (cyberverseSets.gen3.has(tokenId)) return 'Gen3';
    if (cyberverseSets.cars.has(tokenId)) return 'Car';
    if (cyberverseSets.apartments.has(tokenId)) return 'Apartment';
    if (cyberverseSets.pets.has(tokenId)) return 'Pet';
    if (cyberverseSets.skins.has(tokenId)) return 'Skins';
    if (cyberverseSets.vipcards.has(tokenId)) return 'VIPCard';
    if (cyberverseSets.emotes.has(tokenId)) return 'Emote';
    if (cyberverseSets.audio.has(tokenId)) return 'Audio';
    if (cyberverseSets.jackhammers.has(tokenId)) return 'JackHammer';
    if (cyberverseSets.eggs.has(tokenId)) return 'Egg';

    return null;
  };

  // Filter NFTs to only CyberVerse items
  const cyberverseNfts = useMemo(() => {
    if (!cyberverseSets) return [];

    return nfts
      .map(nft => ({
        ...nft,
        cyberverseCategory: categorizeToken(nft.tokenId),
      }))
      .filter(nft => nft.cyberverseCategory !== null);
  }, [nfts, cyberverseSets]);

  // Filter by selected category
  const filteredNfts = useMemo(() => {
    if (selectedCategory === 'All') {
      return cyberverseNfts;
    }
    return cyberverseNfts.filter(nft => nft.cyberverseCategory === selectedCategory);
  }, [cyberverseNfts, selectedCategory]);

  // Pagination
  const totalPages = Math.ceil(filteredNfts.length / PAGE_SIZE);
  const paginatedNfts = filteredNfts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handlePrevPage = () => setPage(p => Math.max(0, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages - 1, p + 1));

  const handleCategoryChange = (category: CyberVerseCategory) => {
    setSelectedCategory(category);
    setPage(0);
  };

  // Category colors
  const getCategoryColor = (category: CyberVerseCategory | null) => {
    switch (category) {
      case 'Gen2':
        return 'bg-cyan-600';
      case 'Gen3':
        return 'bg-purple-600';
      case 'Car':
        return 'bg-orange-600';
      case 'Apartment':
        return 'bg-emerald-600';
      case 'Pet':
        return 'bg-yellow-600';
      case 'Skins':
        return 'bg-rose-600';
      case 'VIPCard':
        return 'bg-amber-600';
      case 'Emote':
        return 'bg-pink-600';
      case 'Audio':
        return 'bg-indigo-600';
      case 'JackHammer':
        return 'bg-slate-600';
      case 'Egg':
        return 'bg-lime-600';
      default:
        return 'bg-cyan-600';
    }
  };

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts: Record<CyberVerseCategory, number> = {
      All: cyberverseNfts.length,
      Gen2: 0,
      Gen3: 0,
      Car: 0,
      Apartment: 0,
      Pet: 0,
      Skins: 0,
      VIPCard: 0,
      Emote: 0,
      Audio: 0,
      JackHammer: 0,
      Egg: 0,
    };

    cyberverseNfts.forEach(nft => {
      if (nft.cyberverseCategory) {
        counts[nft.cyberverseCategory]++;
      }
    });

    return counts;
  }, [cyberverseNfts]);

  if (isLoading) {
    return (
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <div className="flex items-center space-x-2 mb-4">
          <Gamepad2 className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">CyberVerse</h2>
          <a
            href="https://playcyberverse.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Play
          </a>
          <a
            href="https://www.cyberversewiki.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Wiki
          </a>
        </div>
        <div className="text-gray-400 text-center py-8">
          Loading CyberVerse assets...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Gamepad2 className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">CyberVerse</h2>
          <a
            href="https://playcyberverse.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Play
          </a>
          <a
            href="https://www.cyberversewiki.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Wiki
          </a>
        </div>
        <div className="flex items-center space-x-3">
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center space-x-1">
              <button
                onClick={handlePrevPage}
                disabled={page === 0}
                className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </button>
              <span className="text-gray-400 text-xs">
                {page + 1}/{totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
          <span className="text-gray-400 text-sm">{filteredNfts.length} item{filteredNfts.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Category filter buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((category) => (
          <button
            key={category}
            className={`px-3 py-1 rounded-lg text-sm ${
              selectedCategory === category
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            onClick={() => handleCategoryChange(category)}
          >
            {categoryLabels[category]}
            {categoryCounts[category] > 0 && (
              <span className="ml-1 text-xs opacity-75">({categoryCounts[category]})</span>
            )}
          </button>
        ))}
      </div>

      {cyberverseNfts.length === 0 ? (
        <div className="text-gray-400 text-center py-8">
          <p>No CyberVerse NFTs found in this wallet</p>
          <p className="text-sm mt-2">CyberVerse NFTs include Gen 2, Gen 3, Cars, Apartments, Pets, and more</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {paginatedNfts.map((nft) => (
            <div
              key={nft.tokenId}
              className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all cursor-pointer group"
              onClick={() => openExplorer(nft.tokenId)}
            >
              {/* Artwork image with placeholder fallback */}
              <div className={`aspect-square ${getCategoryColor(nft.cyberverseCategory)} flex items-center justify-center text-white/80 relative overflow-hidden`}>
                {(() => {
                  const imageUrl = getImageUrl(nft);
                  if (imageUrl) {
                    return (
                      <img
                        src={imageUrl}
                        alt={nft.name}
                        className="w-full h-full object-cover"
                        onError={() => handleImageError(nft.tokenId)}
                      />
                    );
                  }
                  return <Image className="w-8 h-8" />;
                })()}
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
                  <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(nft.cyberverseCategory)} text-white`}>
                    {nft.cyberverseCategory && categoryLabels[nft.cyberverseCategory]}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
