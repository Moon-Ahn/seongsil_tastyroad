import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Star, MapPin, Utensils, Plus, Search,
  MessageSquare, X, Loader2, Map as MapIcon, Church
} from 'lucide-react';

// 🌟 팀장님의 구글 앱스 스크립트 URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdChOl5CumYzkX-rjai2BpD91BQBH193NrKLL2RRIvxGKJFRx0_Si0zIFM_BClJA5M/exec";

const App = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRes, setSelectedRes] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // 직접 입력 방식으로 롤백
  const [newRes, setNewRes] = useState({ name: '', category: '한식', address: '' });
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', author: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 각 식당까지의 거리를 저장할 공간
  const [distances, setDistances] = useState({});

  // 구글 지도 제어를 위한 Ref
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const geocodeCache = useRef({}); // 주소->좌표 변환 캐시

  const CHURCH_ADDRESS = "서울 강북구 노해로 50";

  // 1. 데이터 불러오기
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
    } catch (e) {
      console.error("데이터 로딩 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(); }, []);

  // 🌟 주소를 좌표로 변환해주는 헬퍼 함수
  const getCoordinates = (address, callback) => {
    if (geocodeCache.current[address]) {
      callback(geocodeCache.current[address]);
      return;
    }
    if (!window.google) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: address }, (results, status) => {
      if (status === "OK") {
        geocodeCache.current[address] = results[0].geometry.location;
        callback(results[0].geometry.location);
      }
    });
  };

  // 🌟 구글 지도 초기화, 마커 렌더링, 라벨(말풍선) 표시 및 거리 계산
  useEffect(() => {
    if (loading || !window.google || !mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
      });

      // 1) 교회 마커 추가 (예쁜 말풍선 포함)
      getCoordinates(CHURCH_ADDRESS, (churchLocation) => {
        mapInstance.current.setCenter(churchLocation);
        new window.google.maps.Marker({
          map: mapInstance.current,
          position: churchLocation,
          title: "수유 성실교회",
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            labelOrigin: new window.google.maps.Point(14, -15) // 라벨 위치 위로 조정
          },
          label: {
            text: "수유 성실교회",
            className: "church-marker-label",
            fontWeight: "bold"
          }
        });

        // 2) 식당 마커 추가 (말풍선 포함) 및 거리 계산
        restaurants.forEach(res => {
          getCoordinates(res.address, (location) => {
            const marker = new window.google.maps.Marker({
              map: mapInstance.current,
              position: location,
              title: res.name,
              icon: {
                url: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
                labelOrigin: new window.google.maps.Point(14, -15) // 라벨 위치 위로 조정
              },
              label: {
                text: res.name,
                className: "restaurant-marker-label",
                fontWeight: "bold"
              }
            });

            marker.addListener("click", () => {
              setSelectedRes(res);
            });
            markersRef.current.push(marker);

            // 거리 계산 (미터 단위)
            if (window.google.maps.geometry) {
               const dist = window.google.maps.geometry.spherical.computeDistanceBetween(churchLocation, location);
               setDistances(prev => ({ ...prev, [res.id]: dist }));
            }
          });
        });
      });
    }
  }, [loading, restaurants]);

  // 🌟 리스트에서 식당 클릭 시 지도 이동시키기
  useEffect(() => {
    if (!mapInstance.current) return;

    if (selectedRes) {
      getCoordinates(selectedRes.address, (location) => {
        mapInstance.current.panTo(location); // 부드럽게 이동
        mapInstance.current.setZoom(17); // 확 땡겨서 보여줌
      });
    } else {
      getCoordinates(CHURCH_ADDRESS, (location) => {
        mapInstance.current.panTo(location);
        mapInstance.current.setZoom(16);
      });
    }
  }, [selectedRes]);

  const filteredList = restaurants.filter(r =>
    r.name.includes(searchQuery) || r.address.includes(searchQuery)
  );

  // 리뷰 제출
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

  // 새 식당 등록 (직접 타이핑)
  const handleAddRestaurant = async (e) => {
    e.preventDefault();
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

      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl shadow-md">
            <Utensils className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tight">성실 맛집 <span className="text-orange-500">Map</span></h1>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition shadow-md">
          <Plus size={16} /> 맛집 수동 등록
        </button>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

        {/* 🗺️ 왼쪽: 커스텀 구글 맵 영역 */}
        <section className="lg:w-1/2 h-1/2 lg:h-full relative border-r border-slate-200 bg-slate-200">
          <div ref={mapRef} className="w-full h-full" />

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

        {/* 📝 오른쪽: 리스트 및 상세 리뷰 */}
        <section className="lg:w-1/2 h-1/2 lg:h-full flex flex-col bg-white">
          <div className="p-4 border-b border-slate-100 shrink-0 bg-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="맛집 이름이나 주소 검색..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-sm shadow-sm"
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="lg:w-2/5 border-r border-slate-100 overflow-y-auto custom-scrollbar p-2 space-y-2">
              <button
                onClick={() => setSelectedRes(null)}
                className={`w-full text-left p-4 rounded-xl border-2 transition ${!selectedRes ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}
              >
                <h3 className="font-bold text-blue-900 truncate">수유 성실교회</h3>
                <p className="text-xs text-blue-500 mt-1">우리들의 베이스캠프</p>
              </button>

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

                    {/* 🌟 뱃지 형태로 거리 표시 */}
                    {distances[res.id] && (
                      <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        📍 {distances[res.id] < 1000
                            ? `${Math.round(distances[res.id])}m`
                            : `${(distances[res.id] / 1000).toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:w-3/5 overflow-y-auto custom-scrollbar p-6 bg-slate-50">
              {selectedRes ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-black">{selectedRes.name}</h2>
                      <p className="text-xs text-slate-500 mt-1"><MapPin size={12} className="inline mr-1"/>{selectedRes.address}</p>
                    </div>
                    <button onClick={() => setIsReviewModalOpen(true)} className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap shadow-md hover:scale-105 transition">
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
                  <div className="bg-blue-100 p-4 rounded-full shadow-inner">
                    <Church size={32} className="text-blue-500" />
                  </div>
                  <p className="text-center leading-relaxed">
                    <strong>수유 성실교회</strong>를 중심으로<br/>
                    청년들의 맛집 지도가 펼쳐집니다.<br/><br/>
                    왼쪽 목록이나 지도의 핀을 클릭해보세요!
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 모달: 맛집 수동 등록 (직접 타이핑 방식 롤백) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-black">새 맛집 직접 등록하기</h2>
              <X className="cursor-pointer text-slate-400 hover:text-slate-900 transition" onClick={() => setIsAddModalOpen(false)} />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">식당 이름</label>
                <input required className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-orange-400 outline-none text-sm" placeholder="예: 엘림들깨수제비" value={newRes.name} onChange={e => setNewRes({...newRes, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">도로명 주소 (정확하게 입력해야 지도에 표시됩니다)</label>
                <input required className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-orange-400 outline-none text-sm" placeholder="예: 서울 강북구 삼각산로 67" value={newRes.address} onChange={e => setNewRes({...newRes, address: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">카테고리</label>
                <select className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 text-sm" value={newRes.category} onChange={e => setNewRes({...newRes, category: e.target.value})}>
                  {['한식', '중식', '일식', '양식', '분식', '카페'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="border-t border-slate-100 pt-3 mt-3">
                <p className="text-sm font-bold text-slate-800 mb-2">첫 리뷰를 남겨주세요!</p>
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={24} className={`cursor-pointer transition hover:scale-110 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />
                  ))}
                </div>
                <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 mb-2 outline-none focus:border-orange-400 text-sm" placeholder="한 줄 평 (예: 가성비 최고예요!)" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} />
                <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 text-sm" placeholder="작성자 닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold mt-4 flex justify-center items-center shadow-lg hover:bg-orange-600 transition">
               {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : "지도에 추가하기 🚀"}
            </button>
          </form>
        </div>
      )}

      {/* 모달: 리뷰 쓰기 */}
      {isReviewModalOpen && selectedRes && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form onSubmit={handleReviewSubmit} className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h2 className="text-xl font-black">"{selectedRes.name}" 리뷰</h2>
            <div className="flex gap-2 justify-center py-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={32} className={`cursor-pointer transition hover:scale-110 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />
              ))}
            </div>
            <textarea required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 text-sm h-24" placeholder="맛, 분위기, 가성비 등 어떠셨나요?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})}></textarea>
            <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 text-sm" placeholder="작성자 닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsReviewModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition">취소</button>
              <button type="submit" disabled={isSubmitting} className="flex-[2] py-3 bg-orange-500 text-white rounded-xl font-bold flex justify-center items-center hover:bg-orange-600 transition shadow-md">
                {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : "등록하기"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 🌟 CSS 스타일: 스크롤바 커스텀 및 마커 라벨 디자인 */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

        .church-marker-label {
          background-color: white;
          color: #1e3a8a;
          font-size: 13px;
          padding: 4px 10px;
          border-radius: 8px;
          border: 2px solid #3b82f6;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          margin-top: -30px;
          white-space: nowrap;
        }

        .restaurant-marker-label {
          background-color: white;
          color: #ea580c;
          font-size: 13px;
          padding: 4px 10px;
          border-radius: 8px;
          border: 2px solid #f97316;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          margin-top: -30px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

export default App;