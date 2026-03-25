import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Star, MapPin, Utensils, Plus, Search,
  Navigation, MessageSquare, X, Loader2, Map as MapIcon
} from 'lucide-react';

// 팀장님의 구글 앱스 스크립트 URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdChOl5CumYzkX-rjai2BpD91BQBH193NrKLL2RRIvxGKJFRx0_Si0zIFM_BClJA5M/exec";

const App = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRes, setSelectedRes] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const [newRes, setNewRes] = useState({ name: '', category: '한식', address: '' });
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', author: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 구글 장소 검색창을 위한 Ref
  const searchInputRef = useRef(null);

  // 데이터 불러오기 (초기 1회)
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
      if (processedList.length > 0) setSelectedRes(processedList[0]);
    } catch (e) {
      console.error("데이터 로딩 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(); }, []);

  // 🌟 구글 장소 자동완성 기능 세팅 (모달이 열릴 때 실행)
  useEffect(() => {
    if (isAddModalOpen && searchInputRef.current && window.google) {
      const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
        types: ['establishment'], // 상호명 검색 허용
        componentRestrictions: { country: 'kr' } // 한국 내로 한정
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
          alert("드롭다운 목록에서 정확한 구글 지도 장소를 선택해주세요.");
          return;
        }
        // 구글 지도에서 선택한 정보로 자동 채우기
        setNewRes(prev => ({
          ...prev,
          name: place.name,
          address: place.formatted_address.replace("대한민국 ", "") // 주소 깔끔하게
        }));
      });
    }
  }, [isAddModalOpen]);

  // 필터링된 식당 목록
  const filteredList = restaurants.filter(r =>
    r.name.includes(searchQuery) || r.address.includes(searchQuery)
  );

  // 리뷰 저장 로직 (낙관적 업데이트)
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

  // 새 식당 등록 (첫 리뷰 포함)
  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRes.name || !newRes.address) {
      alert("구글 지도 검색을 통해 식당을 선택해주세요!");
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
    setSelectedRes(newRestaurantData);

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

  if (loading) return <div className="h-screen flex items-center justify-center text-orange-500 font-bold"><Loader2 className="animate-spin mr-2"/> 맛집 지도를 불러오는 중...</div>;

  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 flex flex-col overflow-hidden">

      {/* 🔹 상단 헤더 */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl">
            <Utensils className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tight">성실 맛집 <span className="text-orange-500">Map</span></h1>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition"
        >
          <Plus size={16} /> 새로운 맛집 제보
        </button>
      </header>

      {/* 🔹 메인 분할 화면 */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

        {/* 🗺️ 왼쪽: 구글 맵 (선택된 식당 위치로 자동 이동) */}
        <section className="lg:w-1/2 h-1/2 lg:h-full bg-slate-200 relative border-r border-slate-200">
          {selectedRes ? (
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              // 🌟 클릭 시 해당 주소로 자동 이동하도록 URL 수정
              src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedRes.name + " " + selectedRes.address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
              title="Restaurant Map"
            ></iframe>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">목록에서 식당을 클릭해보세요!</div>
          )}
        </section>

        {/* 📝 오른쪽: 식당 리스트 및 상세 리뷰 */}
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
            {/* 맛집 목록 리스트 */}
            <div className="lg:w-2/5 border-r border-slate-100 overflow-y-auto custom-scrollbar p-2 space-y-2">
              {filteredList.map(res => (
                <div
                  key={res.id}
                  onClick={() => setSelectedRes(res)} // 🌟 클릭 시 selectedRes 변경 -> 왼쪽 지도 즉시 이동!
                  className={`p-4 rounded-xl cursor-pointer border-2 transition ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400 shadow-md' : 'bg-white border-transparent hover:bg-slate-50'}`}
                >
                  <h3 className="font-bold text-slate-900 truncate">{res.name}</h3>
                  <div className="flex items-center gap-1 mt-1 text-sm font-bold text-slate-600">
                    <Star size={14} className="fill-orange-400 text-orange-400" />
                    {res.avgRating} <span className="text-slate-400 text-xs font-normal">({res.reviews.length})</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 선택된 맛집의 상세 리뷰 피드 */}
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
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">리스트에서 식당을 선택해주세요.</div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 🔹 모달: 새 식당 등록하기 (Google 장소 자동완성 적용) */}
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
                {/* 🌟 여기에 검색하면 구글 드롭다운이 뜹니다 */}
                <input
                  ref={searchInputRef}
                  className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-orange-400 outline-none text-sm"
                  placeholder="식당 이름을 검색하세요 (예: 엘림들깨수제비)"
                />
              </div>

              {/* 검색 후 자동으로 채워지는 부분 (수동 수정 불가) */}
              <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                <p className="text-xs text-orange-600 font-bold mb-1">검색된 정보 (자동입력)</p>
                <p className="text-sm font-bold text-slate-800">{newRes.name || "식당을 검색해주세요"}</p>
                <p className="text-xs text-slate-500">{newRes.address || ""}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">카테고리</label>
                <select className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none" value={newRes.category} onChange={e => setNewRes({...newRes, category: e.target.value})}>
                  {['한식', '중식', '일식', '양식', '분식', '카페'].map(c => <option key={c}>{c}</option>)}
                </select>
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

      {/* 모달: 리뷰 쓰기 (생략, 기존과 동일) */}
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