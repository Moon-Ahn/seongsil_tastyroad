import React, { useState, useEffect, useRef } from 'react';
import {
  Star, MapPin, Utensils, Plus, Search, MessageSquare,
  X, Loader2, Map as MapIcon, Church, MapPinned, Navigation,
  Coffee, Sun, Heart
} from 'lucide-react';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdChOl5CumYzkX-rjai2BpD91BQBH193NrKLL2RRIvxGKJFRx0_Si0zIFM_BClJA5M/exec";

const App = () => {
  // --- [상태 관리] ---
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRes, setSelectedRes] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');

  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // 등록 및 리뷰 상태
  const [newRes, setNewRes] = useState({ name: '', category: '한식', address: '' });
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', author: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualAddress, setIsManualAddress] = useState(false);

  // 식당 검색 상태
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [distances, setDistances] = useState({});

  // Refs
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({}); // 마커 필터링을 위해 객체로 관리
  const geocodeCache = useRef({});
  const myLocMarkerRef = useRef(null);
  const listRef = useRef(null);
  const detailRef = useRef(null);

  const CHURCH_ADDRESS = "서울 강북구 노해로 50";
  const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '분식', '카페'];

  // --- [모바일 바텀시트 제어] ---
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

  // 식당 클릭 시 모바일에서 시트 올리기
  useEffect(() => {
    if (selectedRes && isMobile) setSheetY(60);
  }, [selectedRes, isMobile]);

  const onTouchStart = (e) => {
    if (!isMobile) return;
    const isHandle = e.target.closest('.sheet-handle-area');
    if (isHandle) {
      handleDragRef.current = { active: true, startY: e.touches[0].clientY, startSheetY: sheetY };
    }
  };

  const onTouchMove = (e) => {
    if (!handleDragRef.current.active || !isMobile) return;
    const delta = e.touches[0].clientY - handleDragRef.current.startY;
    const newY = Math.max(60, Math.min(handleDragRef.current.startSheetY + delta, window.innerHeight - peekHeight));
    if (e.cancelable) e.preventDefault();
    setSheetY(newY);
  };

  const onTouchEnd = () => {
    if (!handleDragRef.current.active || !isMobile) return;
    handleDragRef.current.active = false;
    if (sheetY < window.innerHeight * 0.45) setSheetY(60);
    else setSheetY(window.innerHeight - peekHeight);
  };

  const blockMap = (e) => { if (isMobile) e.stopPropagation(); };

  // --- [데이터 필터링 로직] ---
  const filteredList = restaurants.filter(r => {
    const matchesSearch = r.name.includes(searchQuery) || r.address.includes(searchQuery);
    let matchesCategory = false;

    if (activeCategory === '전체') matchesCategory = true;
    else if (activeCategory === '점심추천') matchesCategory = r.isLunch;
    else if (activeCategory === '심방추천') matchesCategory = r.isVisitation;
    else matchesCategory = r.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  // 필터링에 맞춰 지도 마커 실시간 업데이트
  useEffect(() => {
    if (!mapInstance.current) return;
    Object.keys(markersRef.current).forEach(resId => {
      const isVisible = filteredList.some(r => r.id === resId);
      markersRef.current[resId].setMap(isVisible ? mapInstance.current : null);
    });
  }, [activeCategory, searchQuery, restaurants]);

  // --- [구글 맵 및 데이터 로드] ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        const grouped = data.reduce((acc, curr) => {
          if (!acc[curr.restaurant]) {
            acc[curr.restaurant] = {
              id: curr.restaurant, name: curr.restaurant, address: curr.address || "",
              category: curr.category || "기타", isLunch: curr.isLunch === 'o', isVisitation: curr.isVisitation === 'o',
              reviews: [], avgRating: 0
            };
          }
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
    loadData();
  }, []);

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
      new window.google.maps.Marker({
        map: mapInstance.current, position: churchLoc, title: "성실교회",
        icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", labelOrigin: new window.google.maps.Point(14, -15) },
        label: { text: "수유 성실교회", className: "church-marker-label", fontWeight: "bold" }
      });

      restaurants.forEach(res => {
        getCoordinates(res.address, (loc) => {
          const labelClass = res.category === '카페' ? 'cafe-marker-label' : 'restaurant-marker-label';
          const marker = new window.google.maps.Marker({
            map: mapInstance.current, position: loc, title: res.name,
            icon: { url: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png", labelOrigin: new window.google.maps.Point(14, -15) },
            label: { text: res.name, className: labelClass, fontWeight: "bold" }
          });
          marker.addListener("click", () => { setSelectedRes(res); if (isMobile) setSheetY(60); });
          markersRef.current[res.id] = marker;
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

  const moveToMyLocation = () => {
    if (!navigator.geolocation) return alert("GPS 권한을 허용해주세요.");
    navigator.geolocation.getCurrentPosition((pos) => {
      const myPos = new window.google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
      mapInstance.current.panTo(myPos);
      mapInstance.current.setZoom(17);
      if (myLocMarkerRef.current) myLocMarkerRef.current.setMap(null);
      myLocMarkerRef.current = new window.google.maps.Marker({
        position: myPos, map: mapInstance.current,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#3B82F6', fillOpacity: 1, strokeWeight: 3, strokeColor: '#FFF', scale: 8 }
      });
    }, () => alert("위치를 가져올 수 없습니다."));
  };

  // --- [서버 제출 로직] ---
  const handleReviewSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const reviewData = { restaurant: selectedRes.name, address: selectedRes.address, category: selectedRes.category, rating: Number(newReview.rating), comment: newReview.comment, author: newReview.author, timestamp: new Date().toISOString() };
    const updatedRes = { ...selectedRes, reviews: [reviewData, ...selectedRes.reviews] };
    updatedRes.avgRating = (updatedRes.reviews.reduce((s, r) => s + r.rating, 0) / updatedRes.reviews.length).toFixed(1);
    setSelectedRes(updatedRes);
    setRestaurants(prev => prev.map(r => r.id === updatedRes.id ? updatedRes : r));
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(reviewData) }); alert("리뷰 등록 완료!"); }
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

  const handleSelectPlace = (p) => {
    setNewRes({ ...newRes, name: p.place_name, address: p.road_address_name || p.address_name });
    setSearchResults([]); setSearchKeyword('');
  };

  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRes.name || !newRes.address) return alert("식당을 선택해주세요.");
    setIsSubmitting(true);
    const initialReview = { restaurant: newRes.name, address: newRes.address, category: newRes.category, rating: newReview.rating, comment: newReview.comment, author: newReview.author, timestamp: new Date().toISOString() };
    const newData = { id: newRes.name, name: newRes.name, address: newRes.address, category: newRes.category, avgRating: newReview.rating.toFixed(1), reviews: [initialReview], isLunch: false, isVisitation: false };
    setRestaurants([newData, ...restaurants]); setSelectedRes(newData);
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(initialReview) }); alert("맛집 등록 완료!"); }
    finally { setIsSubmitting(false); setIsAddModalOpen(false); setNewRes({ name: '', category: '한식', address: '' }); setNewReview({ rating: 5, comment: '', author: '' }); setIsManualAddress(false); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-orange-500" size={40} /></div>;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row bg-slate-50 font-sans">

      {/* 🗺️ 지도 영역 */}
      <div className="relative flex-1 h-1/2 lg:h-full order-1 lg:order-2">
        <div ref={mapRef} className="w-full h-full" />

        {/* 상단 통합 헤더 */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="flex-1 lg:max-w-xs bg-white rounded-2xl shadow-xl flex items-center px-4 py-3 gap-3 pointer-events-auto border border-slate-100">
              <div className="bg-orange-500 p-1.5 rounded-lg shrink-0 shadow-sm"><Utensils className="text-white" size={14} /></div>
              <span className="font-black text-sm tracking-tight text-slate-800">성실 맛집 <span className="text-orange-500">Map</span></span>
            </div>
            <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-500 text-white w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center shrink-0 active:scale-95 transition pointer-events-auto border-2 border-white"><Plus size={20} /></button>
          </div>

          {/* 🍱 추천 버튼 그룹 */}
          <div className="flex gap-2 pointer-events-auto">
            <button onClick={() => setActiveCategory(activeCategory === '점심추천' ? '전체' : '점심추천')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl shadow-lg font-bold text-[11px] transition-all active:scale-95
                               ${activeCategory === '점심추천' ? 'bg-slate-800 text-white' : 'bg-white text-slate-800 border border-slate-100'}`}>
              <Sun size={14} /> 점심먹기 좋은 곳
            </button>
            <button onClick={() => setActiveCategory(activeCategory === '심방추천' ? '전체' : '심방추천')}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl shadow-lg font-bold text-[11px] transition-all active:scale-95
                               ${activeCategory === '심방추천' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-100'}`}>
              <Heart size={14} /> 심방하기 좋은 곳
            </button>
          </div>
        </div>

        <button onClick={moveToMyLocation} className="absolute right-4 z-10 bg-white p-3.5 rounded-full shadow-2xl border active:scale-90 transition-all" style={{ bottom: isMobile ? `calc(100vh - ${sheetY}px + 20px)` : '2rem' }}><Navigation size={22} className="text-slate-700" /></button>
      </div>

      {/* 📝 바텀 시트 (리스트 & 상세 통합) */}
      <section
        className={`z-20 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.12)] flex flex-col transition-all duration-300
                    ${isMobile ? 'fixed left-0 right-0 bottom-0 rounded-t-[32px]' : 'relative w-[400px] h-full shadow-none border-r border-slate-200'}`}
        style={isMobile ? { transform: `translateY(${sheetY}px)`, height: 'calc(100vh - 60px)', transition: handleDragRef.current.active ? 'none' : 'transform 0.3s ease-out' } : {}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        {isMobile && <div className="sheet-handle-area w-full pt-4 pb-3 flex justify-center items-center shrink-0 select-none cursor-ns-resize"><div className="w-12 h-1.5 bg-slate-200 rounded-full" /></div>}

        {/* ── 리스트 화면 ── */}
        <div className={`flex-1 flex flex-col overflow-hidden ${selectedRes && isMobile ? 'hidden' : 'flex'}`}>
          <div className="px-4 pb-3 border-b border-slate-50 shrink-0 bg-white">
            <div className="relative mt-1">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input type="text" placeholder="맛집 이름, 주소 검색..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-orange-400 text-base lg:text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORIES.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${activeCategory === cat ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}>{cat}</button>)}
            </div>
          </div>
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-slate-50/30" onTouchStart={blockMap} style={{ overscrollBehavior: 'contain' }}>
            {activeCategory === '전체' && <button onClick={() => setSelectedRes(null)} className="w-full text-left p-4 rounded-3xl bg-blue-50 border border-blue-100 shadow-sm active:scale-95 transition-all"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0"><Church size={18} className="text-blue-500" /></div><div><h3 className="font-bold text-blue-900 text-sm">수유 성실교회</h3><p className="text-[11px] text-blue-400 font-medium">우리들의 베이스캠프 ⛪</p></div></div></button>}
            {filteredList.map(res => (
              <div key={res.id} onClick={() => setSelectedRes(res)} className={`p-4 rounded-3xl cursor-pointer border-2 transition-all active:scale-98 ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400 shadow-md' : 'bg-white border-transparent shadow-sm hover:shadow-md'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 text-sm truncate pr-2">{res.name}</h3>
                  <div className="flex gap-1">
                    {res.isLunch && <span className="text-[9px] bg-slate-800 text-white px-1.5 py-0.5 rounded font-bold">점심</span>}
                    {res.isVisitation && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">심방</span>}
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold shrink-0 ${res.category === '카페' ? 'bg-orange-100 text-orange-600' : 'bg-slate-800 text-white'}`}>{res.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 bg-white border border-slate-100 px-2 py-0.5 rounded-full shadow-sm"><Star size={12} className="fill-orange-400 text-orange-400" /><span className="text-xs font-black text-slate-700">{res.avgRating}</span></div>
                  {distances[res.id] && <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">⛪ {Math.round(distances[res.id])}m</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 상세 화면 ── */}
        {selectedRes && (
          <div className={`flex-1 flex flex-col overflow-hidden bg-white ${isMobile ? '' : 'absolute inset-0 z-30'}`}>
            <div className="px-5 pt-2 pb-5 border-b border-slate-50 shrink-0">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-4">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${selectedRes.category === '카페' ? 'bg-orange-100 text-orange-600' : 'bg-slate-800 text-white'}`}>{selectedRes.category}</span>
                  <h2 className="text-2xl font-black text-slate-900 mt-2 leading-tight truncate">{selectedRes.name}</h2>
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium"><MapPin size={13} className="text-orange-400" />{selectedRes.address}</p>
                    {distances[selectedRes.id] && <p className="text-xs font-bold text-blue-600 bg-blue-50 w-fit px-3 py-1 rounded-full shadow-sm flex items-center gap-1">⛪ 성실교회에서 {Math.round(distances[selectedRes.id])}m 거리</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedRes(null)} className="p-2.5 bg-slate-100 rounded-full active:scale-90 transition-all"><X size={20} className="text-slate-500" /></button>
              </div>
              <div className="flex gap-2.5 mt-5">
                <a href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedRes.name + " 수유동")}`} target="_blank" rel="noreferrer" className="flex-1 bg-green-500 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-100"><MapIcon size={16} /> 길찾기</a>
                <button onClick={() => setIsReviewModalOpen(true)} className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-200"><MessageSquare size={16} /> 리뷰 쓰기</button>
              </div>
            </div>
            <div ref={detailRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-slate-50/50" onTouchStart={blockMap} style={{ overscrollBehavior: 'contain' }}>
              <h4 className="font-black text-slate-800 text-sm ml-1">청년부 리뷰 <span className="text-orange-500">{selectedRes.reviews.length}</span></h4>
              {selectedRes.reviews.length === 0 ? <p className="text-center text-slate-400 text-xs py-14 font-medium">아직 리뷰가 없어요. 첫 리뷰를 남겨주세요! ✨</p> :
                selectedRes.reviews.map((r, i) => (
                  <div key={i} className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-sm text-slate-800">{r.author}</span>
                      <div className="flex gap-0.5">{[1,2,3,4,5].map(n => <Star key={n} size={11} className={n <= r.rating ? "fill-orange-400 text-orange-400" : "text-slate-200"} />)}</div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">{r.comment}</p>
                    <p className="text-[10px] text-slate-400 mt-3.5 text-right font-bold">{new Date(r.timestamp).toLocaleDateString()}</p>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </section>

      {/* ── 모달: 새 맛집 등록 ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-[40px] w-full max-w-md flex flex-col shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="flex justify-between items-center px-7 py-6 border-b shrink-0">
              <h2 className="text-xl font-black text-slate-900">새 맛집 제보 🥘</h2>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-7 py-6 space-y-6 no-scrollbar">
              <div className="flex justify-end"><label className="flex items-center gap-2 text-xs font-bold text-orange-500 cursor-pointer bg-orange-50 px-3 py-1.5 rounded-full"><input type="checkbox" className="w-4 h-4 rounded-md accent-orange-500" checked={isManualAddress} onChange={(e) => setIsManualAddress(e.target.checked)} /> 직접 주소 입력</label></div>
              {!isManualAddress ? (
                <div className="bg-slate-50 p-5 rounded-[28px] border border-slate-100 space-y-4">
                  <div className="flex gap-2">
                    <input type="text" className="flex-1 p-3.5 bg-white rounded-2xl shadow-sm outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="식당 이름으로 검색" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchPlaces())} />
                    <button type="button" onClick={searchPlaces} className="px-5 py-3.5 bg-slate-800 text-white rounded-2xl font-black text-xs shadow-lg">{isSearching ? <Loader2 className="animate-spin" size={18}/> : '검색'}</button>
                  </div>
                  {searchResults.length > 0 && <ul className="max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-2xl divide-y no-scrollbar shadow-xl">{searchResults.map(p => <li key={p.id} onClick={() => handleSelectPlace(p)} className="p-4 hover:bg-orange-50 cursor-pointer active:bg-orange-100"><div className="font-black text-sm text-slate-800">{p.place_name}</div><div className="text-[11px] font-bold text-slate-400 mt-1">{p.address_name}</div></li>)}</ul>}
                  {newRes.name && <div className="p-4 bg-white rounded-2xl border-2 border-orange-400 shadow-md animate-pulse"><p className="font-black text-orange-600 text-sm">{newRes.name}</p><p className="text-[11px] text-slate-500 font-bold mt-1">{newRes.address}</p></div>}
                </div>
              ) : (
                <div className="space-y-3 p-5 bg-orange-50/50 rounded-[28px] border-2 border-orange-100">
                  <input required className="w-full p-4 rounded-2xl border-none shadow-sm outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="식당 이름" value={newRes.name} onChange={e => setNewRes({...newRes, name: e.target.value})} />
                  <input required className="w-full p-4 rounded-2xl border-none shadow-sm outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="도로명 주소" value={newRes.address} onChange={e => setNewRes({...newRes, address: e.target.value})} />
                </div>
              )}
              <div className="space-y-4">
                 <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">카테고리</label>
                    <select className="w-full mt-2 p-4 bg-slate-50 rounded-2xl outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" value={newRes.category} onChange={e => setNewRes({...newRes, category: e.target.value})}>{CATEGORIES.filter(c => c !== '전체').map(c => <option key={c}>{c}</option>)}</select>
                 </div>
                 <div className="pt-4 border-t border-slate-100 space-y-5">
                    <p className="text-sm font-black text-slate-700 text-center">첫 번째 리뷰 남기기 ✨</p>
                    <div className="flex gap-2.5 justify-center">
                        {[1,2,3,4,5].map(i => <Star key={i} size={32} className={`cursor-pointer transition-all hover:scale-125 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}
                    </div>
                    <input required className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="이 맛집의 한 줄 평은?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} />
                    <input required className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="작성자 닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
                 </div>
              </div>
            </div>
            <div className="p-7 border-t shrink-0 bg-slate-50/50 rounded-b-[40px]"><button type="submit" disabled={isSubmitting} className="w-full py-4.5 bg-orange-500 text-white rounded-[24px] font-black shadow-xl shadow-orange-200 active:scale-95 transition-all flex justify-center items-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <>맛집 등록 완료 🚀</>}</button></div>
          </form>
        </div>
      )}

      {/* ── 모달: 리뷰 쓰기 ── */}
      {isReviewModalOpen && selectedRes && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <form onSubmit={handleReviewSubmit} className="bg-white rounded-[40px] w-full max-w-sm p-8 space-y-6 shadow-2xl">
            <h2 className="text-xl font-black text-center text-slate-800">"{selectedRes.name}" <br/>리뷰 남기기 ✍️</h2>
            <div className="flex gap-2.5 justify-center py-2">
              {[1,2,3,4,5].map(i => <Star key={i} size={38} className={`cursor-pointer transition-all hover:scale-125 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}
            </div>
            <textarea required className="w-full p-4 bg-slate-50 rounded-[24px] shadow-inner h-36 text-base lg:text-sm outline-none focus:ring-2 focus:ring-orange-400" placeholder="맛, 분위기, 서비스는 어땠나요?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})}></textarea>
            <input required className="w-full p-4 bg-slate-50 rounded-2xl shadow-inner text-base lg:text-sm outline-none focus:ring-2 focus:ring-orange-400" placeholder="닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
            <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsReviewModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm transition-colors">취소</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] py-4 bg-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-100 active:scale-95 transition-all">{isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20}/> : "리뷰 등록"}</button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* 🌟 폰트 살짝 낮춤 반영 (11px) */
        .restaurant-marker-label { background-color: #1e293b; color: white; font-size: 11px; padding: 4px 10px; border-radius: 10px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25); margin-top: -30px; white-space: nowrap; pointer-events: none; }
        .cafe-marker-label { background-color: #f97316; color: white; font-size: 11px; padding: 4px 10px; border-radius: 10px; border: 2px solid white; box-shadow: 0 4px 10px rgba(249,115,22,0.3); margin-top: -30px; white-space: nowrap; pointer-events: none; }
        .church-marker-label { background-color: #1e3a8a; color: white; font-size: 11px; padding: 5px 12px; border-radius: 10px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.15); margin-top: -30px; white-space: nowrap; pointer-events: none; }

        input, select, textarea { font-size: 16px !important; }
      `}</style>
    </div>
  );
};

export default App;