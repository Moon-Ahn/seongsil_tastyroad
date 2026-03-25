### 🚀 최종 완성본: `App.jsx` 전체 코드

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Star, 
  MapPin, 
  Utensils, 
  Plus, 
  Search, 
  Navigation, 
  MessageSquare, 
  X,
  Loader2,
  Map as MapIcon
} from 'lucide-react';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdChOl5CumYzkX-rjai2BpD91BQBH193NrKLL2RRIvxGKJFRx0_Si0zIFM_BClJA5M/exec"; // 여기에 팀장님의 구글 앱스 스크립트 URL을 넣으세요!

const App = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRes, setSelectedRes] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  
  // 폼 상태
  const [newRes, setNewRes] = useState({ name: '', category: '한식', address: '', tags: '' });
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', author: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. 데이터 불러오기 (초기 로딩 시 1회)
  const fetchRestaurants = async () => {
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();
      
      // 구글 시트에서 가져온 데이터를 레스토랑별로 그룹화
      const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.restaurant]) {
          acc[curr.restaurant] = {
            id: curr.restaurant,
            name: curr.restaurant,
            address: curr.address || "주소 정보 없음", // 시트에 주소 열이 추가되어야 함
            category: curr.category || "맛집",
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

      // 평균 별점 계산
      const processedList = Object.values(grouped).map(res => {
        const total = res.reviews.reduce((sum, r) => sum + r.rating, 0);
        res.avgRating = (total / res.reviews.length).toFixed(1);
        // 최신 리뷰가 위로 오도록 정렬
        res.reviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return res;
      });

      setRestaurants(processedList);
      if (processedList.length > 0 && !selectedRes) {
        setSelectedRes(processedList[0]);
      }
    } catch (e) {
      console.error("데이터 로딩 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 필터링된 식당 목록
  const filteredList = restaurants.filter(r => 
    r.name.includes(searchQuery) || r.address.includes(searchQuery)
  );

  // 2. 카카오 주소 검색 열기
  const openAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: function(data) {
        setNewRes(prev => ({ ...prev, address: data.roadAddress || data.jibunAddress }));
      }
    }).open();
  };

  // 3. 리뷰 저장하기 (낙관적 업데이트 적용: 즉시 화면에 보임)
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const reviewData = {
      restaurant: selectedRes.name,
      address: selectedRes.address,
      category: selectedRes.category,
      rating: newReview.rating,
      comment: newReview.comment,
      author: newReview.author,
      timestamp: new Date().toISOString()
    };

    // 화면에 먼저 즉시 반영 (낙관적 업데이트)
    const updatedRes = { ...selectedRes };
    updatedRes.reviews = [reviewData, ...updatedRes.reviews];
    const newTotal = updatedRes.reviews.reduce((sum, r) => sum + r.rating, 0);
    updatedRes.avgRating = (newTotal / updatedRes.reviews.length).toFixed(1);
    
    setSelectedRes(updatedRes);
    setRestaurants(prev => prev.map(r => r.id === updatedRes.id ? updatedRes : r));

    try {
      // 구글 시트로 백그라운드 전송
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });
      alert("리뷰가 등록되었습니다!");
    } catch (e) {
      alert("네트워크 오류가 발생했지만, 화면에는 임시 저장되었습니다.");
    } finally {
      setIsSubmitting(false);
      setIsReviewModalOpen(false);
      setNewReview({ rating: 5, comment: '', author: '' });
    }
  };

  // 4. 새 식당 등록하기 (첫 리뷰 동시 작성)
  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const initialReview = {
      restaurant: newRes.name,
      address: newRes.address,
      category: newRes.category,
      rating: newReview.rating,
      comment: newReview.comment,
      author: newReview.author,
      timestamp: new Date().toISOString()
    };

    // 화면에 즉시 반영
    const newRestaurantData = {
      id: newRes.name,
      name: newRes.name,
      address: newRes.address,
      category: newRes.category,
      avgRating: newReview.rating.toFixed(1),
      reviews: [initialReview]
    };
    
    setRestaurants([newRestaurantData, ...restaurants]);
    setSelectedRes(newRestaurantData);

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(initialReview)
      });
      alert("새로운 맛집이 등록되었습니다!");
    } finally {
      setIsSubmitting(false);
      setIsAddModalOpen(false);
      setNewRes({ name: '', category: '한식', address: '', tags: '' });
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
          <Plus size={16} /> 맛집 추가하기
        </button>
      </header>

      {/* 🔹 메인 분할 화면 (왼쪽: 지도 / 오른쪽: 목록 및 리뷰) */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* 🗺️ 왼쪽: 구글 맵 (네이버 지도로 가는 버튼 포함) */}
        <section className="lg:w-1/2 h-1/2 lg:h-full bg-slate-200 relative border-r border-slate-200">
          {selectedRes ? (
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedRes.name + " " + selectedRes.address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
              title="Restaurant Map"
            ></iframe>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">식당을 선택해주세요.</div>
          )}
          
          {/* 네이버 지도 길찾기 플로팅 버튼 */}
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

        {/* 📝 오른쪽: 식당 리스트 및 상세 리뷰 */}
        <section className="lg:w-1/2 h-1/2 lg:h-full flex flex-col bg-white">
          
          {/* 검색바 */}
          <div className="p-4 border-b border-slate-100 shrink-0 bg-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="맛집 이름이나 주소 검색..." 
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* 맛집 목록 리스트 (스크롤) */}
            <div className="lg:w-2/5 border-r border-slate-100 overflow-y-auto custom-scrollbar p-2 space-y-2">
              {filteredList.map(res => (
                <div 
                  key={res.id}
                  onClick={() => setSelectedRes(res)}
                  className={`p-4 rounded-xl cursor-pointer border-2 transition ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400' : 'bg-white border-transparent hover:bg-slate-50'}`}
                >
                  <h3 className="font-bold text-slate-900 truncate">{res.name}</h3>
                  <div className="flex items-center gap-1 mt-1 text-sm font-bold text-slate-600">
                    <Star size={14} className="fill-orange-400 text-orange-400" />
                    {res.avgRating} <span className="text-slate-400 text-xs font-normal">({res.reviews.length})</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 truncate"><MapPin size={10} className="inline mr-1"/>{res.address}</p>
                </div>
              ))}
            </div>

            {/* 선택된 맛집의 상세 리뷰 피드 */}
            <div className="lg:w-3/5 overflow-y-auto custom-scrollbar p-6 bg-slate-50">
              {selectedRes ? (
                <>
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h2 className="text-2xl font-black">{selectedRes.name}</h2>
                      <p className="text-sm text-slate-500 mt-1">{selectedRes.address}</p>
                    </div>
                    <button 
                      onClick={() => setIsReviewModalOpen(true)}
                      className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800"
                    >
                      <MessageSquare size={16} /> 리뷰 쓰기
                    </button>
                  </div>

                  <div className="space-y-4">
                    {selectedRes.reviews.map((r, i) => (
                      <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-sm text-slate-800">{r.author}</span>
                          <div className="flex">
                            {[1,2,3,4,5].map(num => (
                              <Star key={num} size={12} className={num <= r.rating ? "fill-orange-400 text-orange-400" : "text-slate-200"} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{r.comment}</p>
                        <p className="text-[10px] text-slate-400 mt-2 text-right">{new Date(r.timestamp).toLocaleDateString()}</p>
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

      {/* 🔹 모달: 리뷰 쓰기 */}
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

      {/* 🔹 모달: 새 식당 등록하기 (Daum 주소검색 적용) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-black">새 맛집 제보하기</h2>
              <X className="cursor-pointer text-slate-400" onClick={() => setIsAddModalOpen(false)} />
            </div>
            
            <div className="space-y-3">
              <input required name="name" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-orange-400 outline-none text-sm" placeholder="식당 이름" value={newRes.name} onChange={e => setNewRes({...newRes, name: e.target.value})} />
              
              {/* 카카오 주소 검색 버튼 */}
              <div className="flex gap-2">
                <input required readOnly className="flex-1 p-3 bg-slate-100 rounded-xl border border-slate-200 text-sm text-slate-600" placeholder="주소를 검색해주세요" value={newRes.address} />
                <button type="button" onClick={openAddressSearch} className="px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm whitespace-nowrap">주소 찾기</button>
              </div>

              <div className="border-t border-slate-100 pt-3 mt-3">
                <p className="text-sm font-bold text-slate-600 mb-2">첫 리뷰를 남겨주세요!</p>
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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;