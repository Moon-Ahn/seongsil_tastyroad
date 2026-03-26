import React, { useState, useEffect, useRef } from 'react';
import {
  Star, MapPin, Utensils, Plus, Search, MessageSquare,
  X, Loader2, Map as MapIcon, Church, MapPinned, Navigation
} from 'lucide-react';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdChOl5CumYzkX-rjai2BpD91BQBH193NrKLL2RRIvxGKJFRx0_Si0zIFM_BClJA5M/exec";

const App = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRes, setSelectedRes] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newRes, setNewRes] = useState({ name: '', category: '한식', address: '' });
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', author: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualAddress, setIsManualAddress] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [distances, setDistances] = useState({});

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const geocodeCache = useRef({});
  const myLocMarkerRef = useRef(null);

  const CHURCH_ADDRESS = "서울 강북구 노해로 50";
  const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '분식', '카페'];

  // ─── 바텀시트 / 반응형 ───────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const peekHeight = 160;
  const [sheetY, setSheetY] = useState(window.innerWidth < 1024 ? window.innerHeight - peekHeight : 0);
  const handleDragRef = useRef({ active: false, startY: 0, startSheetY: 0 });

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setSheetY(window.innerHeight - peekHeight);
      else setSheetY(0);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onHandleTouchStart = (e) => {
    if (!isMobile) return;
    handleDragRef.current = { active: true, startY: e.touches[0].clientY, startSheetY: sheetY };
  };
  const onHandleTouchMove = (e) => {
    if (!handleDragRef.current.active || !isMobile) return;
    e.preventDefault();
    const delta = e.touches[0].clientY - handleDragRef.current.startY;
    const newY = Math.max(60, Math.min(handleDragRef.current.startSheetY + delta, window.innerHeight - peekHeight));
    setSheetY(newY);
  };
  const onHandleTouchEnd = () => {
    if (!handleDragRef.current.active || !isMobile) return;
    handleDragRef.current.active = false;
    setSheetY(sheetY < window.innerHeight * 0.45 ? 60 : window.innerHeight - peekHeight);
  };

  const blockMap = (e) => { if (isMobile) e.stopPropagation(); };

  const mobileSheetStyle = isMobile ? {
    transform: `translateY(${sheetY}px)`,
    transition: handleDragRef.current.active ? 'none' : 'transform 0.3s ease-out',
    height: `calc(100vh - 60px)`,
  } : {};

  // ─── 내 위치 ────────────────────────────────────────────────
  const moveToMyLocation = () => {
    if (!navigator.geolocation) return alert("GPS를 지원하지 않습니다.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myPos = new window.google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        mapInstance.current.panTo(myPos);
        mapInstance.current.setZoom(17);
        if (myLocMarkerRef.current) myLocMarkerRef.current.setMap(null);
        myLocMarkerRef.current = new window.google.maps.Marker({
          position: myPos, map: mapInstance.current,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#3B82F6', fillOpacity: 1, strokeWeight: 3, strokeColor: '#FFF', scale: 9 }
        });
      },
      () => alert("위치 권한을 확인해주세요."), { enableHighAccuracy: true }
    );
  };

  // ─── 데이터 ────────────────────────────────────────────────
  const fetchRestaurants = async () => {
    try {
      const res = await fetch(SCRIPT_URL);
      const data = await res.json();
      const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.restaurant]) acc[curr.restaurant] = { id: curr.restaurant, name: curr.restaurant, address: curr.address || "", category: curr.category || "기타", reviews: [], avgRating: 0 };
        acc[curr.restaurant].reviews.push({ rating: Number(curr.rating), comment: curr.comment, author: curr.author, timestamp: curr.timestamp });
        return acc;
      }, {});
      const list = Object.values(grouped).map(r => {
        r.avgRating = (r.reviews.reduce((s, v) => s + v.rating, 0) / r.reviews.length).toFixed(1);
        r.reviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return r;
      });
      setRestaurants(list);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { fetchRestaurants(); }, []);

  const getCoordinates = (address, cb) => {
    if (geocodeCache.current[address]) return cb(geocodeCache.current[address]);
    if (!window.google) return;
    new window.google.maps.Geocoder().geocode({ address }, (results, status) => {
      if (status === "OK") { geocodeCache.current[address] = results[0].geometry.location; cb(results[0].geometry.location); }
    });
  };

  useEffect(() => {
    if (loading || !window.google || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      zoom: 16, mapTypeControl: false, streetViewControl: false, disableDefaultUI: true,
      styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }, { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }]
    });
    getCoordinates(CHURCH_ADDRESS, (churchLoc) => {
      mapInstance.current.setCenter(churchLoc);
      new window.google.maps.Marker({ map: mapInstance.current, position: churchLoc, title: "성실교회", icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", labelOrigin: new window.google.maps.Point(14, -15) }, label: { text: "수유 성실교회", className: "church-marker-label", fontWeight: "bold" } });
      restaurants.forEach(res => {
        getCoordinates(res.address, (loc) => {
          const marker = new window.google.maps.Marker({ map: mapInstance.current, position: loc, title: res.name, icon: { url: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png", labelOrigin: new window.google.maps.Point(14, -15) }, label: { text: res.name, className: "restaurant-marker-label", fontWeight: "bold" } });
          marker.addListener("click", () => setSelectedRes(res));
          markersRef.current.push(marker);
          if (window.google.maps.geometry) {
            const dist = window.google.maps.geometry.spherical.computeDistanceBetween(churchLoc, loc);
            setDistances(prev => ({ ...prev, [res.id]: dist }));
          }
        });
      });
    });
  }, [loading, restaurants]);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (selectedRes) getCoordinates(selectedRes.address, (loc) => { mapInstance.current.panTo(loc); mapInstance.current.setZoom(17); });
    else getCoordinates(CHURCH_ADDRESS, (loc) => { mapInstance.current.panTo(loc); mapInstance.current.setZoom(16); });
  }, [selectedRes]);

  const filteredList = restaurants.filter(r => (r.name.includes(searchQuery) || r.address.includes(searchQuery)) && (activeCategory === '전체' || r.category === activeCategory));

  const handleReviewSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const reviewData = { restaurant: selectedRes.name, address: selectedRes.address, category: selectedRes.category, rating: Number(newReview.rating), comment: newReview.comment, author: newReview.author, timestamp: new Date().toISOString() };
    const updatedRes = { ...selectedRes, reviews: [reviewData, ...selectedRes.reviews] };
    updatedRes.avgRating = (updatedRes.reviews.reduce((s, r) => s + r.rating, 0) / updatedRes.reviews.length).toFixed(1);
    setSelectedRes(updatedRes);
    setRestaurants(prev => prev.map(r => r.id === updatedRes.id ? updatedRes : r));
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(reviewData) }); alert("리뷰가 등록되었습니다!"); }
    finally { setIsSubmitting(false); setIsReviewModalOpen(false); setNewReview({ rating: 5, comment: '', author: '' }); }
  };

  const searchPlaces = () => {
    if (!searchKeyword.trim() || !window.kakao) return;
    setIsSearching(true);
    window.kakao.maps.load(() => {
      const ps = new window.kakao.maps.services.Places();
      ps.keywordSearch(searchKeyword, (data, status) => {
        if (status === window.kakao.maps.services.Status.OK) setSearchResults(data);
        else { alert("결과 없음"); setSearchResults([]); }
        setIsSearching(false);
      });
    });
  };

  const handleSelectPlace = (place) => {
    setNewRes({ ...newRes, name: place.place_name, address: place.road_address_name || place.address_name });
    setSearchResults([]); setSearchKeyword('');
  };

  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRes.name || !newRes.address) return alert("식당을 선택해주세요.");
    setIsSubmitting(true);
    const initialReview = { restaurant: newRes.name, address: newRes.address, category: newRes.category, rating: newReview.rating, comment: newReview.comment, author: newReview.author, timestamp: new Date().toISOString() };
    const newData = { id: newRes.name, name: newRes.name, address: newRes.address, category: newRes.category, avgRating: newReview.rating.toFixed(1), reviews: [initialReview] };
    setRestaurants([newData, ...restaurants]); setSelectedRes(newData);
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(initialReview) }); alert("맛집 등록 완료!"); }
    finally { setIsSubmitting(false); setIsAddModalOpen(false); setNewRes({ name: '', category: '한식', address: '' }); setNewReview({ rating: 5, comment: '', author: '' }); setIsManualAddress(false); }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="bg-orange-500 p-3 rounded-2xl"><Utensils className="text-white" size={24} /></div>
        <Loader2 className="animate-spin text-orange-400" size={24} />
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row bg-slate-50">

      {/* 🗺️ 지도 영역 (PC에서는 우측 60%) */}
      <div className="relative flex-1 h-1/2 lg:h-full order-1 lg:order-2">
        <div ref={mapRef} className="w-full h-full" />

        {/* 상단 헤더 (플로팅) */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-3 pointer-events-none">
          <div className="flex-1 lg:max-w-xs bg-white rounded-2xl shadow-xl flex items-center px-4 py-3 gap-3 pointer-events-auto">
            <div className="bg-orange-500 p-1.5 rounded-lg shrink-0"><Utensils className="text-white" size={14} /></div>
            <span className="font-black text-sm">성실 맛집 <span className="text-orange-500">Map</span></span>
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-500 text-white w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center shrink-0 active:scale-95 transition pointer-events-auto"><Plus size={20} /></button>
        </div>

        {/* 내 위치 버튼 */}
        <button onClick={moveToMyLocation} className="absolute right-4 z-10 bg-white p-3 rounded-full shadow-xl border border-slate-200 active:scale-95 transition"
          style={{ bottom: isMobile ? `calc(100vh - ${sheetY}px + 12px)` : '2rem' }}><Navigation size={22} className="text-slate-700" /></button>
      </div>

      {/* 📝 목록 & 상세 패널 (PC에서는 좌측 400px 고정) */}
      <section
        className={`z-20 bg-white shadow-2xl flex flex-col transition-all duration-300
                    ${isMobile ? 'absolute left-0 right-0 bottom-0 rounded-t-3xl' : 'relative w-[400px] h-full shadow-none border-r border-slate-200'}`}
        style={isMobile ? mobileSheetStyle : {}}
        onTouchStart={blockMap} onTouchMove={blockMap} onTouchEnd={blockMap}
      >
        {/* 모바일 핸들 */}
        {isMobile && (
          <div className="w-full pt-4 pb-3 flex justify-center items-center shrink-0"
               style={{ touchAction: 'none', cursor: 'ns-resize' }}
               onTouchStart={onHandleTouchStart} onTouchMove={onHandleTouchMove} onTouchEnd={onHandleTouchEnd}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
          </div>
        )}

        {/* 콘텐츠 영역 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 검색 + 카테고리 */}
          <div className="px-4 pb-3 border-b border-slate-100 shrink-0 bg-white">
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <input type="text" placeholder="맛집 이름, 주소 검색..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 custom-scrollbar">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition ${activeCategory === cat ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{cat}</button>
              ))}
            </div>
          </div>

          {/* 목록 영역 */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 custom-scrollbar" style={{ overscrollBehavior: 'contain' }}>
            {activeCategory === '전체' && (
              <button onClick={() => setSelectedRes(null)} className="w-full text-left p-4 rounded-2xl bg-blue-50 border border-blue-100 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center"><Church size={16} className="text-blue-500" /></div>
                  <div><h3 className="font-bold text-blue-900 text-sm">수유 성실교회</h3><p className="text-[11px] text-blue-400">우리들의 베이스캠프</p></div>
                </div>
              </button>
            )}
            {filteredList.map(res => (
              <div key={res.id} onClick={() => setSelectedRes(res)} className={`p-4 rounded-2xl cursor-pointer border-2 transition ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400' : 'bg-white border-transparent shadow-sm hover:border-slate-200'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-bold text-slate-900 text-sm truncate pr-2">{res.name}</h3>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">{res.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5"><Star size={11} className="fill-orange-400 text-orange-400" /><span className="text-xs font-bold text-slate-600">{res.avgRating}</span></div>
                  {distances[res.id] && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">⛪ {distances[res.id] < 1000 ? `${Math.round(distances[res.id])}m` : `${(distances[res.id] / 1000).toFixed(1)}km`}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🌟 식당 상세 패널 (PC에서는 리스트 위에 덮음, 모바일은 팝업) */}
        {selectedRes && (
          <div className={`absolute inset-0 z-30 bg-white flex flex-col transition-all duration-300
                          ${isMobile ? 'rounded-t-3xl' : ''}`}>
            <div className="flex justify-between items-center px-5 pt-5 pb-4 border-b shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded">{selectedRes.category}</span>
                <h2 className="text-xl font-black text-slate-900 mt-1 truncate">{selectedRes.name}</h2>
              </div>
              <button onClick={() => setSelectedRes(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"><X size={18} className="text-slate-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar" style={{ overscrollBehavior: 'contain' }}>
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500 flex items-center gap-1.5"><MapPin size={13} className="text-orange-400" />{selectedRes.address}</p>
                {distances[selectedRes.id] && <p className="text-xs font-bold text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-lg">⛪ 성실교회에서 {Math.round(distances[selectedRes.id])}m 거리에 위치</p>}
              </div>

              <div className="flex gap-2">
                <a href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedRes.name + " 수유동")}`} target="_blank" rel="noreferrer" className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition"><MapIcon size={14} /> 길찾기</a>
                <button onClick={() => setIsReviewModalOpen(true)} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition"><MessageSquare size={14} /> 리뷰 쓰기</button>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h4 className="font-bold text-slate-800 text-sm">청년부 리뷰 ({selectedRes.reviews.length})</h4>
                {selectedRes.reviews.length === 0 ? <p className="text-center text-slate-400 text-xs py-10">첫 리뷰를 남겨주세요!</p> :
                  selectedRes.reviews.map((r, i) => (
                    <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-xs text-slate-700">{r.author}</span>
                        <div className="flex">{[1,2,3,4,5].map(n => <Star key={n} size={10} className={n <= r.rating ? "fill-orange-400 text-orange-400" : "text-slate-200"} />)}</div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{r.comment}</p>
                      <p className="text-[10px] text-slate-400 mt-2 text-right">{new Date(r.timestamp).toLocaleDateString()}</p>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 모달: 새 맛집 등록 ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center lg:items-center justify-center z-50 backdrop-blur-sm p-4">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-[32px] w-full max-w-md flex flex-col shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="flex justify-between items-center px-6 py-5 border-b shrink-0">
              <h2 className="text-lg font-black">새 맛집 제보하기</h2>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setSearchResults([]); setSearchKeyword(''); }}><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5 custom-scrollbar">
              <div className="flex justify-end"><label className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded" checked={isManualAddress} onChange={(e) => setIsManualAddress(e.target.checked)} /> 직접 주소 입력</label></div>
              {!isManualAddress ? (
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-3">
                  <div className="flex gap-2">
                    <input type="text" className="flex-1 p-3 bg-white rounded-xl border outline-none text-sm focus:border-orange-400" placeholder="식당 이름 검색" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchPlaces())} />
                    <button type="button" onClick={searchPlaces} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs">{isSearching ? <Loader2 className="animate-spin" size={16}/> : '검색'}</button>
                  </div>
                  {searchResults.length > 0 && <ul className="max-h-40 overflow-y-auto bg-white border rounded-xl divide-y custom-scrollbar">{searchResults.map(p => <li key={p.id} onClick={() => handleSelectPlace(p)} className="p-3 hover:bg-orange-50 cursor-pointer text-xs font-bold">{p.place_name}<br/><span className="text-[10px] font-normal text-slate-400">{p.address_name}</span></li>)}</ul>}
                  {newRes.name && <div className="p-3 bg-orange-100 rounded-xl text-xs font-bold">{newRes.name}<br/><span className="font-normal">{newRes.address}</span></div>}
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <input required className="w-full p-3 rounded-xl border text-sm" placeholder="식당 이름" value={newRes.name} onChange={e => setNewRes({...newRes, name: e.target.value})} />
                  <input required className="w-full p-3 rounded-xl border text-sm" placeholder="도로명 주소" value={newRes.address} onChange={e => setNewRes({...newRes, address: e.target.value})} />
                </div>
              )}
              <select className="w-full p-3 bg-slate-50 rounded-xl border text-sm" value={newRes.category} onChange={e => setNewRes({...newRes, category: e.target.value})}>{CATEGORIES.filter(c => c !== '전체').map(c => <option key={c}>{c}</option>)}</select>
              <div className="pt-4 border-t space-y-4">
                <div className="flex gap-1.5 justify-center">{[1,2,3,4,5].map(i => <Star key={i} size={28} className={`cursor-pointer ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}</div>
                <input required className="w-full p-3 bg-slate-50 rounded-xl border text-sm" placeholder="첫 한 줄 평" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} />
                <input required className="w-full p-3 bg-slate-50 rounded-xl border text-sm" placeholder="닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
              </div>
            </div>
            <div className="p-6 border-t shrink-0"><button type="submit" disabled={isSubmitting} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg">{isSubmitting ? <Loader2 className="animate-spin m-auto" size={20}/> : "지도에 추가하기 🚀"}</button></div>
          </form>
        </div>
      )}

      {/* ── 모달: 리뷰 쓰기 ── */}
      {isReviewModalOpen && selectedRes && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <form onSubmit={handleReviewSubmit} className="bg-white rounded-[32px] w-full max-w-sm p-7 space-y-5 shadow-2xl">
            <h2 className="text-lg font-black text-center">"{selectedRes.name}" 리뷰</h2>
            <div className="flex gap-2.5 justify-center py-2">{[1,2,3,4,5].map(i => <Star key={i} size={36} className={`cursor-pointer ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}</div>
            <textarea required className="w-full p-4 bg-slate-50 rounded-2xl border h-32 text-sm outline-none focus:border-orange-400" placeholder="솔직한 평가를 남겨주세요!" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})}></textarea>
            <input required className="w-full p-4 bg-slate-50 rounded-2xl border text-sm outline-none focus:border-orange-400" placeholder="닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
            <div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsReviewModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm">취소</button><button type="submit" disabled={isSubmitting} className="flex-[2] py-3 bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md">{isSubmitting ? <Loader2 className="animate-spin m-auto" size={18}/> : "등록하기"}</button></div>
          </form>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .church-marker-label { background-color: white; color: #1e3a8a; font-size: 11px; padding: 4px 10px; border-radius: 8px; border: 2.5px solid #3b82f6; box-shadow: 0 4px 10px rgba(0,0,0,0.15); margin-top: -32px; white-space: nowrap; pointer-events: none; }
        .restaurant-marker-label { background-color: white; color: #ea580c; font-size: 11px; padding: 4px 10px; border-radius: 8px; border: 2.5px solid #f97316; box-shadow: 0 4px 10px rgba(0,0,0,0.15); margin-top: -32px; white-space: nowrap; pointer-events: none; }
        input, select, textarea { font-size: 16px !important; }
      `}</style>
    </div>
  );
};

export default App;