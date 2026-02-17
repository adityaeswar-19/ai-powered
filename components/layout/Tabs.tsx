
import React from 'react';
import { FeatureId } from '../../constants';

interface Feature {
  id: FeatureId;
  name: string;
  icon: React.ReactNode;
}

interface TabsProps {
  features: Feature[];
  activeFeature: FeatureId;
  setActiveFeature: (feature: FeatureId) => void;
}

const Tabs: React.FC<TabsProps> = ({ features, activeFeature, setActiveFeature }) => {
  return (
    <div className="flex justify-center border-b border-gray-700">
      <div className="flex space-x-2 sm:space-x-4" role="tablist">
        {features.map((feature) => (
          <button
            key={feature.id}
            onClick={() => setActiveFeature(feature.id)}
            className={`flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm sm:text-base font-medium rounded-t-lg focus:outline-none transition-all duration-200 ease-in-out
              ${
                activeFeature === feature.id
                  ? 'border-b-2 border-purple-400 text-purple-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }
            `}
            role="tab"
            aria-selected={activeFeature === feature.id}
          >
            {feature.icon}
            <span className="hidden sm:inline">{feature.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Tabs;
