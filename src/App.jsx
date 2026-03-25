import React, { useState, useMemo } from 'react';
import {
  Star,
  MapPin,
  Utensils,
  Plus,
  Search,
  Navigation,
  MessageSquare,
  X,
  Map as MapIcon
} from 'lucide-react';

// --- [초기 데이터] 수유역/성실교회 근처 맛집 리스트 ---
const initialRestaurants = [
  {
    id: 1,
    name: "엘림들깨수제비",
    category: "한식",
    address: "서울 강북구 삼각산로 67",
    avgRating: 4.8,
    reviewCount: 12,
    tags: ["들깨가득", "가성비갑", "어르신입맛"],
    locationKeyword: "수유동 엘림들깨수제비"
  },
  {
    id: 2,
    name: "진주성",
    category: "중식",
    address: "서울 강북구 수유로 55",
    avgRating: 4.2,
    reviewCount: 8,
    tags: ["청년부단골", "탕수육맛집", "신속배달"],
    locationKeyword: "수유동 진주성"
  },
  {
    id: 3,
    name: "칠복떡볶이",
    category: "분식",
    address: "서울 강북구 도봉로87길 26",
    avgRating: 4.5,
    reviewCount: 15,
    tags: ["매콤달콤", "인생떡볶이", "혼밥가능"],
    locationKeyword: "수유역 칠복떡볶이"
  },
  {
    id: 4,
    name: "카페 티에드",
    category: "카페",
    address: "서울 강북구 노해로 33",
    avgRating: 4.7,
    reviewCount: 20,
    tags: ["분위기맛집", "조용한교제", "커피향가득"],
    locationKeyword: "수유동 카페 티에드"
  }
];

const App = () => {
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [selectedId, setSelectedId] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // 현재 선택된 맛집 정보
  const activeRes = useMemo(() =>
    restaurants.find(r => r.id === selectedId) || restaurants[0]
  , [selectedId, restaurants]);

  // 필터링된 목록
  const filteredList = restaurants.filter(r => {
    const matchesSearch = r.name.includes(searchQuery) || r.tags.some(t => t.includes(searchQuery));
    const matchesCategory = categoryFilter === '전체' || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // 새 맛집 등록 처리
  const handleAddRestaurant = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newRes = {
      id: Date.now(),
      name: formData.get('name'),
      category: formData.get('category'),
      address: formData.get('address'),
      avgRating: 0,
      reviewCount: 0,
      tags: formData.get('tags').split(',').map(t => t.trim()),
      locationKeyword: formData.get('name') + " 수유동"
    };
    setRestaurants([newRes, ...restaurants]);
    setIsModalOpen(false);
    showMessage("새로운 맛집이 등록되었습니다! 🎉");
  };

  const showMessage = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* 상단 바 */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2 rounded-xl shadow-lg shadow-orange-100">
              <Utensils className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-black tracking-tight">성실 맛집 <span className="text-orange-500">Gourmet</span></h1>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition shadow-md"
          >
            <Plus size={16} /> 맛집 제보
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6 overflow-hidden">

        {/* 왼쪽 섹션: 목록 및 검색 (LG: 5/12) */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden h-[calc(100vh-140px)]">
          {/* 검색 및 필터 */}
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="식당 이름이나 태그 검색..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-400 transition outline-none text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {['전체', '한식', '중식', '일식', '양식', '분식', '카페'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${categoryFilter === cat ? 'bg-orange-500 text-white shadow-md shadow-orange-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 맛집 리스트 */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {filteredList.map(res => (
              <div
                key={res.id}
                onClick={() => setSelectedId(res.id)}
                className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedId === res.id ? 'bg-white border-orange-500 shadow-xl scale-[1.01]' : 'bg-white border-transparent hover:border-slate-200 shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-500 px-2 py-0.5 bg-orange-50 rounded italic border border-orange-100">
                    {res.category}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                    <Star size={14} className="fill-orange-400 text-orange-400" />
                    <span className="text-slate-700">{res.avgRating}</span>
                    <span>({res.reviewCount})</span>
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{res.name}</h3>
                <p className="text-xs text-slate-500 mb-3 truncate">{res.address}</p>
                <div className="flex flex-wrap gap-1">
                  {res.tags.map((tag, idx) => (
                    <span key={idx} className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded italic">#{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽 섹션: 상세 정보 및 지도 (LG: 7/12) */}
        <div className="lg:col-span-7 flex flex-col gap-4 overflow-hidden h-[calc(100vh-140px)]">
          {/* 상단 지도 */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 h-2/3 overflow-hidden relative group">
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(activeRes.locationKeyword)}&t=&z=17&ie=UTF8&iwloc=&output=embed`}
              title="Restaurant Map"
              className="grayscale-[0.2] contrast-[1.1]"
            ></iframe>
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(activeRes.name + " 수유동")}`}
                target="_blank"
                rel="noreferrer"
                className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-lg flex items-center justify-center text-green-600 hover:scale-110 transition active:scale-90"
              >
                <Navigation size={20} />
              </a>
            </div>
          </div>

          {/* 하단 상세 정보 카드 */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{activeRes.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin size={14} className="text-orange-500" />
                  <span className="text-sm text-slate-500">{activeRes.address}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 mb-1">
                  <Star size={24} className="fill-orange-400 text-orange-400" />
                  <span className="text-2xl font-black text-slate-900">{activeRes.avgRating}</span>
                </div>
                <p className="text-xs text-slate-400 font-bold">{activeRes.reviewCount}개의 성실 리뷰</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => setShowReviewForm(true)}
                className="flex items-center justify-center gap-2 py-3 bg-orange-50 text-orange-600 rounded-2xl font-bold hover:bg-orange-100 transition text-sm border border-orange-200 shadow-sm"
              >
                <MessageSquare size={16} /> 리뷰 작성하기
              </button>
              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(activeRes.name + " 수유동")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-3 bg-green-50 text-green-700 rounded-2xl font-bold hover:bg-green-100 transition text-sm border border-green-200 shadow-sm"
              >
                <MapIcon size={16} /> 네이버 지도로 보기
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* 상태 메시지 토스트 */}
      {statusMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 animate-bounce font-bold text-sm">
          {statusMessage}
        </div>
      )}

      {/* 모달: 새로운 맛집 제보 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-black italic">NEW RESTAURANT</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddRestaurant} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 ml-1 uppercase">식당 이름</label>
                <input name="name" required className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-400 outline-none text-sm" placeholder="예: 수유리 우동집" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 ml-1 uppercase">카테고리</label>
                  <select name="category" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-orange-400 text-sm">
                    {['한식', '중식', '일식', '양식', '분식', '카페'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-400 ml-1 uppercase">태그 (쉼표 구분)</label>
                  <input name="tags" className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-400 outline-none text-sm" placeholder="매콤한, 단체석" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 ml-1 uppercase">주소</label>
                <input name="address" required className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-400 outline-none text-sm" placeholder="도로명 주소를 입력하세요" />
              </div>
              <button type="submit" className="w-full bg-orange-500 text-white py-5 rounded-[1.5rem] font-black text-lg hover:bg-orange-600 transition shadow-lg shadow-orange-100 mt-4">
                맛집 제보하기 🚀
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 모달: 리뷰 작성 (UI만 구현) */}
      {showReviewForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 p-8 text-center space-y-6">
            <h2 className="text-xl font-black italic underline decoration-orange-400 decoration-4">REVIEW NOW</h2>
            <p className="text-slate-500 text-sm font-medium">"{activeRes.name}" 식당은 어떠셨나요?</p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={36} className="text-slate-200 hover:text-orange-400 cursor-pointer transition fill-current" />
              ))}
            </div>
            <textarea className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-orange-400 h-24 text-sm" placeholder="부원들에게 추천하는 이유를 적어주세요!"></textarea>
            <div className="flex gap-2">
              <button onClick={() => setShowReviewForm(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-500">취소</button>
              <button onClick={() => { setShowReviewForm(false); showMessage("리뷰가 등록되었습니다! ⭐"); }} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-bold">리뷰 제출</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoom-in-95 { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-in { animation: 0.3s ease-out forwards; }
        .fade-in { animation-name: fade-in; }
        .zoom-in-95 { animation-name: zoom-in-95; }
      `}</style>
    </div>
  );
};

export default App;