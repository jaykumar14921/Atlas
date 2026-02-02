import React, { useState } from 'react';

export default function LoginModal() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <button
          onClick={() => setIsOpen(true)}
          className="px-6 py-3 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors"
        >
          Show Modal
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 mx-4">
        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Emoji Icons */}
        <div className="flex justify-center mb-6 relative">
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-3xl -mr-3 z-10">
              💪
            </div>
            <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center text-4xl z-20">
              😎
            </div>
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl -ml-3 z-10">
              🥳
            </div>
          </div>
          <div className="h-20"></div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-center mb-4">
          Log In to use Atlas for free
        </h2>

        {/* Description */}
        <p className="text-gray-600 text-center mb-8 leading-relaxed">
          Log In through your Hugging Face account to continue using Atlas and increase your monthly free limit.
        </p>

        {/* Login Button */}
        <button className="w-full bg-black text-white py-4 rounded-full font-semibold text-lg hover:bg-gray-800 transition-colors shadow-lg">
          Log In to Continue
        </button>

        {/* Optional: Additional links */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Don't have an account?{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}