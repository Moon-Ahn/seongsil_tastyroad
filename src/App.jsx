import React, { useState, useEffect, useRef } from 'react';
import {
  Star, MapPin, Utensils, Plus, Search,
  MessageSquare, X, Loader2, Map as MapIcon, Church
} from 'lucide-react';

// 🌟 팀장님의 구글 앱스 스크립트 URL을 넣어주세요
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdChOl5CumYzkX-rjai2BpD91BQBH193NrKLL2RRIvxGKJFRx0_Si0zIFM_BClJA5M/exec";

const App = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1) 초기 선택값을 null로 두어, 처음엔 무조건 교회 지도가 보이도록 설정합니다.
  const [selectedRes, setSelectedRes] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const [newRes, setNewRes] = useState({ name: '', category: '한식', address: '' });
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', author: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchInputRef = useRef(null);

  // 데이터 불러오기
  const fetchRestaurants = async () => {
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();

      const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.restaurant]) {
          acc[curr.restaurant] = {
            id: curr.restaurant,
            name: curr.restaurant,
            address: curr.address || "",
            category: curr.category || "기타",
            reviews: [],
            avgRating: 0
          };
        }
        acc[curr.restaurant].reviews.push({
          rating: Number(curr.rating),
          comment: curr.comment,
          author: curr.author,
          timestamp: curr.timestamp
        });
        return acc;
      }, {});

      const processedList = Object.values(grouped).map(res => {
        const total = res.reviews.reduce((sum, r) => sum + r.rating, 0);
        res.avgRating = (total / res.reviews.length).toFixed(1);
        res.reviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return res;
      });

      setRestaurants(processedList);
      // 🌟 데이터 로딩 후 강제로 첫 번째 식당을 선택하지 않고 null 유지 (교회 화면 고정)
    } catch (e) {
      console.error("데이터 로딩 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(); }, []);

  // 3) 새 맛집 제보 시 구글 검색 버그 수정
  useEffect(() => {
    if (isAddModalOpen && searchInputRef.current && window.google) {
      const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
        fields: ['name', 'formatted_address', 'geometry'], // 필요한 데이터만 정확히 요청
        componentRestrictions: { country: 'kr' }
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        // 사용자가 드롭다운을 클릭하지 않고 타이핑 후 엔터만 친 경우 (undefined 방지)
        if (!place.geometry || !place.formatted_address) {
          alert("아래에 나타나는 구글 지도 자동완성 목록을 마우스로 클릭해서 선택해주세요!");
          return;
        }

        setNewRes(prev => ({
          ...prev,
          name: place.name,
          address: place.formatted_address.replace("대한민국 ", "") // 주소 깔끔하게 정리
        }));
      });
    }
  }, [isAddModalOpen]);

  const filteredList = restaurants.filter(r =>
    r.name.includes(searchQuery) || r.address.includes(searchQuery)
  );

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const reviewData = {
      restaurant: selectedRes.name, address: selectedRes.address,
      category: selectedRes.category, rating: newReview.rating,
      comment: newReview.comment, author: newReview.author,
      timestamp: new Date().toISOString()
    };

    const updatedRes = { ...selectedRes };
    updatedRes.reviews = [reviewData, ...updatedRes.reviews];
    updatedRes.avgRating = (updatedRes.reviews.reduce((sum, r) => sum + r.rating, 0) / updatedRes.reviews.length).toFixed(1);

    setSelectedRes(updatedRes);
    setRestaurants(prev => prev.map(r => r.id === updatedRes.id ? updatedRes : r));

    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(reviewData) });
      alert("리뷰가 등록되었습니다!");
    } finally {
      setIsSubmitting(false);
      setIsReviewModalOpen(false);
      setNewReview({ rating: 5, comment: '', author: '' });
    }
  };

  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRes.name || !newRes.address) {
      alert("검색창에서 식당을 먼저 선택해주세요.");
      return;
    }
    setIsSubmitting(true);

    const initialReview = {
      restaurant: newRes.name, address: newRes.address,
      category: newRes.category, rating: newReview.rating,
      comment: newReview.comment, author: newReview.author,
      timestamp: new Date().toISOString()
    };

    const newRestaurantData = {
      id: newRes.name, name: newRes.name, address: newRes.address,
      category: newRes.category, avgRating: newReview.rating.toFixed(1),
      reviews: [initialReview]
    };

    setRestaurants([newRestaurantData, ...restaurants]);
    setSelectedRes(newRestaurantData); // 🌟 추가 직후 지도를 해당 식당으로 이동

    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(initialReview) });
      alert("새로운 맛집이 등록되었습니다!");
    } finally {
      setIsSubmitting(false);
      setIsAddModalOpen(false);
      setNewRes({ name: '', category: '한식', address: '' });
      setNewReview({ rating: 5, comment: '', author: '' });
    }
  };

  // 🌟 1) 지도 URL 결정 로직 (selectedRes가 없으면 수유 성실교회)
  const mapQuery = selectedRes
    ? `${selectedRes.name} ${selectedRes.address}`
    : "수유 성실교회 서울특별시 강북구 노해로 50";

  // 구글 맵 표준 임베드 URL 형식으로 수정 (2번 해결: 클릭 시 지도 정확히 이동)
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  if (loading) return <div className="h-screen flex items-center justify-center text-orange-500 font-bold"><Loader2 className="animate-spin mr-2"/> 맛집 지도를 불러오는 중...</div>;

  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 flex flex-col overflow-hidden">

      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl">
            <Utensils className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tight">성실 맛집 <span className="text-orange-500">Map</span></h1>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition">
          <Plus size={16} /> 맛집 추가하기
        </button>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

        {/* 왼쪽: 지도 (수유 성실교회 또는 선택한 맛집) */}
        <section className="lg:w-1/2 h-1/2 lg:h-full bg-slate-200 relative border-r border-slate-200">
          <iframe
            width="100%"
            height="100%"
            style={{ border: 0 }}
            src={mapUrl}
            title="Restaurant Map"
          ></iframe>

          {/* 하단 플로팅 버튼 (선택된 식당이 있을 때만 표시) */}
          {selectedRes && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedRes.name + " 수유동")}`}
                target="_blank"
                rel="noreferrer"
                className="bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold hover:bg-green-700 transition hover:scale-105"
              >
                <MapIcon size={18} /> 네이버 지도에서 길찾기
              </a>
            </div>
          )}
        </section>

        {/* 오른쪽: 리스트 및 상세 리뷰 */}
        <section className="lg:w-1/2 h-1/2 lg:h-full flex flex-col bg-white">
          <div className="p-4 border-b border-slate-100 shrink-0 bg-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="맛집 이름이나 주소 검색..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-sm"
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* 리스트 */}
            <div className="lg:w-2/5 border-r border-slate-100 overflow-y-auto custom-scrollbar p-2 space-y-2">
              {filteredList.map(res => (
                <div
                  key={res.id}
                  onClick={() => setSelectedRes(res)}
                  className={`p-4 rounded-xl cursor-pointer border-2 transition ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}
                >
                  <h3 className="font-bold text-slate-900 truncate">{res.name}</h3>
                  <div className="flex items-center gap-1 mt-1 text-sm font-bold text-slate-600">
                    <Star size={14} className="fill-orange-400 text-orange-400" />
                    {res.avgRating} <span className="text-slate-400 text-xs font-normal">({res.reviews.length})</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 상세 내용 */}
            <div className="lg:w-3/5 overflow-y-auto custom-scrollbar p-6 bg-slate-50">
              {selectedRes ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-black">{selectedRes.name}</h2>
                      <p className="text-xs text-slate-500 mt-1"><MapPin size={12} className="inline mr-1"/>{selectedRes.address}</p>
                    </div>
                    <button onClick={() => setIsReviewModalOpen(true)} className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">
                      리뷰 쓰기
                    </button>
                  </div>
                  <div className="space-y-4">
                    {selectedRes.reviews.map((r, i) => (
                      <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-sm text-slate-800">{r.author}</span>
                          <div className="flex">
                            {[1,2,3,4,5].map(num => <Star key={num} size={12} className={num <= r.rating ? "fill-orange-400 text-orange-400" : "text-slate-200"} />)}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-3">
                  <div className="bg-slate-100 p-4 rounded-full">
                    <Church size={32} className="text-slate-400" />
                  </div>
                  <p>왼쪽 목록에서 식당을 선택하면<br/>지도와 상세 리뷰가 나타납니다.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 모달: 맛집 추가 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-black">새 맛집 제보하기</h2>
              <X className="cursor-pointer text-slate-400" onClick={() => setIsAddModalOpen(false)} />
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">구글 지도에서 식당 검색</label>
                <input
                  ref={searchInputRef}
                  className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-orange-400 outline-none text-sm"
                  placeholder="예: 엘림들깨수제비 (검색 후 목록에서 클릭!)"
                />
              </div>

              <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                <p className="text-xs text-orange-600 font-bold mb-1">검색된 정보 (자동입력)</p>
                <p className="text-sm font-bold text-slate-800">{newRes.name || "목록에서 식당을 클릭해주세요"}</p>
                <p className="text-xs text-slate-500">{newRes.address || ""}</p>
              </div>

              <div className="border-t border-slate-100 pt-3 mt-3">
                <p className="text-sm font-bold text-slate-800 mb-2">첫 리뷰를 남겨주세요!</p>
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={24} className={`cursor-pointer ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />
                  ))}
                </div>
                <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 mb-2 outline-none text-sm" placeholder="한 줄 평" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} />
                <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none text-sm" placeholder="작성자 닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold mt-4 flex justify-center items-center">
               {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : "지도에 추가하기 🚀"}
            </button>
          </form>
        </div>
      )}

      {/* 모달: 리뷰 쓰기 */}
      {isReviewModalOpen && selectedRes && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleReviewSubmit} className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h2 className="text-xl font-black">"{selectedRes.name}" 리뷰</h2>
            <div className="flex gap-2 justify-center py-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={32} className={`cursor-pointer ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />
              ))}
            </div>
            <textarea required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 text-sm h-24" placeholder="맛, 분위기, 가성비 등 어떠셨나요?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})}></textarea>
            <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 text-sm" placeholder="작성자 닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsReviewModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-500">취소</button>
              <button type="submit" disabled={isSubmitting} className="flex-[2] py-3 bg-orange-500 text-white rounded-xl font-bold flex justify-center items-center">
                {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : "등록하기"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;