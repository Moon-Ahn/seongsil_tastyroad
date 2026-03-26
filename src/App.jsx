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

  // ─── 바텀시트 ───────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const peekHeight = 160;
  const [sheetY, setSheetY] = useState(window.innerWidth < 1024 ? window.innerHeight - peekHeight : 0);
  const handleDragRef = useRef({ active: false, startY: 0, startSheetY: 0 });

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setSheetY(mobile ? window.innerHeight - peekHeight : 0);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 핸들에서만 시트 드래그
  const onHandleTouchStart = (e) => {
    handleDragRef.current = { active: true, startY: e.touches[0].clientY, startSheetY: sheetY };
  };
  const onHandleTouchMove = (e) => {
    if (!handleDragRef.current.active) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.touches[0].clientY - handleDragRef.current.startY;
    const newY = Math.max(60, Math.min(handleDragRef.current.startSheetY + delta, window.innerHeight - peekHeight));
    setSheetY(newY);
  };
  const onHandleTouchEnd = (e) => {
    if (!handleDragRef.current.active) return;
    handleDragRef.current.active = false;
    setSheetY(sheetY < window.innerHeight * 0.45 ? 60 : window.innerHeight - peekHeight);
  };

  // 시트 내부에서 지도로 터치 이벤트 전파 차단
  const blockMap = (e) => e.stopPropagation();

  const mobileSheetStyle = isMobile ? {
    transform: `translateY(${sheetY}px)`,
    transition: handleDragRef.current.active ? 'none' : 'transform 0.3s ease-out',
    height: `calc(100vh - 60px)`,
  } : {};

  // ─── 내 위치 ────────────────────────────────────────────────
  const moveToMyLocation = () => {
    if (!navigator.geolocation) return alert("GPS를 지원하지 않는 브라우저입니다.");
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
      () => alert("위치 권한을 확인해주세요."),
      { enableHighAccuracy: true }
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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchRestaurants(); }, []);

  const getCoordinates = (address, cb) => {
    if (geocodeCache.current[address]) return cb(geocodeCache.current[address]);
    if (!window.google) return;
    new window.google.maps.Geocoder().geocode({ address }, (results, status) => {
      if (status === "OK") { geocodeCache.current[address] = results[0].geometry.location; cb(results[0].geometry.location); }
    });
  };

  // ─── 구글 맵 ───────────────────────────────────────────────
  useEffect(() => {
    if (loading || !window.google || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      zoom: 16, mapTypeControl: false, streetViewControl: false, disableDefaultUI: true,
      styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }, { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }]
    });
    getCoordinates(CHURCH_ADDRESS, (churchLoc) => {
      mapInstance.current.setCenter(churchLoc);
      new window.google.maps.Marker({
        map: mapInstance.current, position: churchLoc, title: "수유 성실교회",
        icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", labelOrigin: new window.google.maps.Point(14, -15) },
        label: { text: "수유 성실교회", className: "church-marker-label", fontWeight: "bold" }
      });
      restaurants.forEach(res => {
        getCoordinates(res.address, (loc) => {
          const marker = new window.google.maps.Marker({
            map: mapInstance.current, position: loc, title: res.name,
            icon: { url: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png", labelOrigin: new window.google.maps.Point(14, -15) },
            label: { text: res.name, className: "restaurant-marker-label", fontWeight: "bold" }
          });
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

  const filteredList = restaurants.filter(r =>
    (r.name.includes(searchQuery) || r.address.includes(searchQuery)) &&
    (activeCategory === '전체' || r.category === activeCategory)
  );

  // ─── 리뷰 / 등록 ───────────────────────────────────────────
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
        else { alert("검색 결과가 없습니다."); setSearchResults([]); }
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
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(initialReview) }); alert("맛집이 등록되었습니다!"); }
    finally { setIsSubmitting(false); setIsAddModalOpen(false); setNewRes({ name: '', category: '한식', address: '' }); setNewReview({ rating: 5, comment: '', author: '' }); setIsManualAddress(false); }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="bg-orange-500 p-3 rounded-2xl"><Utensils className="text-white" size={24} /></div>
        <p className="text-slate-500 text-sm font-semibold">맛집 지도를 불러오는 중...</p>
        <Loader2 className="animate-spin text-orange-400" size={20} />
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-slate-200">

      {/* 지도 — 터치핸들러 없음, 구글맵이 직접 처리 */}
      <div ref={mapRef} className="absolute inset-0 w-full h-full" />

      {/* 상단 헤더 */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-2 flex items-center gap-3" style={{ pointerEvents: 'none' }}>
        <div className="flex-1 bg-white rounded-2xl shadow-lg flex items-center px-4 py-3 gap-3" style={{ pointerEvents: 'auto' }}>
          <div className="bg-orange-500 p-1.5 rounded-lg shrink-0"><Utensils className="text-white" size={14} /></div>
          <span className="font-black text-sm tracking-tight">성실 맛집 <span className="text-orange-500">Map</span></span>
        </div>
        <button onClick={() => setIsAddModalOpen(true)}
          className="bg-orange-500 text-white w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center shrink-0 active:scale-95 transition"
          style={{ pointerEvents: 'auto' }}>
          <Plus size={20} />
        </button>
      </div>

      {/* 내 위치 버튼 */}
      <button onClick={moveToMyLocation}
        className="absolute right-4 z-20 bg-white p-3 rounded-full shadow-xl border border-slate-200 active:scale-95 transition"
        style={{ bottom: isMobile ? `${window.innerHeight - sheetY + 12}px` : '5rem' }}>
        <Navigation size={22} className="text-slate-700" />
      </button>

      {/* ── 바텀 시트 ── */}
      <section
        className="absolute left-0 right-0 bottom-0 z-20 bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={mobileSheetStyle}
        // 시트 전체 영역에서 터치 이벤트가 지도로 전파되는 것을 차단
        onTouchStart={blockMap}
        onTouchMove={blockMap}
        onTouchEnd={blockMap}
      >
        {/* 핸들 — 여기서만 시트 이동 */}
        <div
          className="lg:hidden w-full pt-4 pb-3 flex justify-center items-center shrink-0 select-none"
          style={{ touchAction: 'none', cursor: 'ns-resize' }}
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* 내부 콘텐츠 — 세로 스크롤만, 지도로 이벤트 전파 없음 */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ touchAction: 'pan-y' }}>

          {/* 검색 + 카테고리 */}
          <div className="px-4 pb-3 border-b border-slate-100 shrink-0 bg-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <input type="text" placeholder="맛집 이름, 주소 검색..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-400"
                style={{ fontSize: '16px' }}
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${activeCategory === cat ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 목록 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
            style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            {activeCategory === '전체' && (
              <button onClick={() => setSelectedRes(null)} className="w-full text-left p-4 rounded-2xl bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <Church size={16} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900 text-sm">수유 성실교회</h3>
                    <p className="text-xs text-blue-400 mt-0.5">우리들의 베이스캠프</p>
                  </div>
                </div>
              </button>
            )}
            {filteredList.map(res => (
              <div key={res.id} onClick={() => setSelectedRes(res)}
                className={`p-4 rounded-2xl cursor-pointer border-2 transition ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400 shadow-sm' : 'bg-white border-transparent shadow-sm'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                    <Utensils size={14} className="text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm truncate pr-1">{res.name}</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">{res.category}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="flex items-center gap-0.5">
                        <Star size={11} className="fill-orange-400 text-orange-400" />
                        <span className="text-xs font-bold text-slate-600">{res.avgRating}</span>
                        <span className="text-xs text-slate-400">({res.reviews.length})</span>
                      </div>
                      {distances[res.id] && (
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                          ⛪ {distances[res.id] < 1000 ? `${Math.round(distances[res.id])}m` : `${(distances[res.id] / 1000).toFixed(1)}km`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 식당 상세 패널 ── */}
      {selectedRes && (
        <div className="absolute inset-0 z-30 flex flex-col" style={{ pointerEvents: 'none' }}>
          <div className="flex-1" style={{ pointerEvents: 'auto' }} onClick={() => setSelectedRes(null)} />
          <div className="bg-white rounded-t-3xl shadow-2xl flex flex-col"
            style={{ pointerEvents: 'auto', maxHeight: '72vh', touchAction: 'pan-y' }}
            onTouchStart={blockMap} onTouchMove={blockMap} onTouchEnd={blockMap}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="px-5 pt-2 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <span className="text-[11px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">{selectedRes.category}</span>
                  <h2 className="text-xl font-black text-slate-900 mt-1 leading-tight">{selectedRes.name}</h2>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin size={11} className="shrink-0" />{selectedRes.address}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <div className="flex items-center gap-0.5">
                      <Star size={12} className="fill-orange-400 text-orange-400" />
                      <span className="text-sm font-bold text-slate-700">{selectedRes.avgRating}</span>
                      <span className="text-xs text-slate-400">({selectedRes.reviews.length}개)</span>
                    </div>
                    {distances[selectedRes.id] && (
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        ⛪ 교회에서 {distances[selectedRes.id] < 1000 ? `${Math.round(distances[selectedRes.id])}m` : `${(distances[selectedRes.id] / 1000).toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedRes(null)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <a href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedRes.name + " 수유동")}`}
                  target="_blank" rel="noreferrer"
                  className="flex-1 bg-green-500 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition">
                  <MapIcon size={15} /> 길찾기
                </a>
                <button onClick={() => setIsReviewModalOpen(true)}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition">
                  <MessageSquare size={15} /> 리뷰 쓰기
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3"
              style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
              {selectedRes.reviews.length === 0
                ? <p className="text-center text-slate-400 text-sm py-8">아직 리뷰가 없습니다</p>
                : selectedRes.reviews.map((r, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-slate-800">{r.author}</span>
                      <div className="flex gap-0.5">{[1,2,3,4,5].map(n => <Star key={n} size={12} className={n <= r.rating ? "fill-orange-400 text-orange-400" : "text-slate-200"} />)}</div>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{r.comment}</p>
                    <p className="text-[10px] text-slate-400 mt-2 text-right">{new Date(r.timestamp).toLocaleDateString()}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── 모달: 새 맛집 등록 ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-end justify-center z-50 backdrop-blur-sm">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-t-3xl w-full max-w-lg flex flex-col" style={{ maxHeight: '92vh' }}>
            <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b shrink-0">
              <h2 className="text-lg font-black">새 맛집 제보하기</h2>
              <button type="button" onClick={() => { setIsAddModalOpen(false); setSearchResults([]); setSearchKeyword(''); }}><X className="text-slate-400" size={22} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div className="flex justify-end">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-500">
                  <input type="checkbox" className="w-4 h-4 accent-orange-500" checked={isManualAddress}
                    onChange={(e) => { setIsManualAddress(e.target.checked); setNewRes({name:'',category:'한식',address:''}); setSearchResults([]); setSearchKeyword(''); }} />
                  직접 입력
                </label>
              </div>
              {!isManualAddress ? (
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-3">
                  <div className="flex gap-2">
                    <input type="text" className="flex-1 p-3 rounded-xl border bg-white outline-none focus:border-orange-400"
                      style={{ fontSize: '16px' }} placeholder="식당 이름 검색" value={searchKeyword}
                      onChange={e => setSearchKeyword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchPlaces())} />
                    <button type="button" onClick={searchPlaces} className="px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm">
                      {isSearching ? <Loader2 className="animate-spin" size={16}/> : '검색'}
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <ul className="max-h-44 overflow-y-auto bg-white border rounded-xl divide-y">
                      {searchResults.map(p => (
                        <li key={p.id} onClick={() => handleSelectPlace(p)} className="p-3 active:bg-orange-50 cursor-pointer">
                          <div className="font-bold text-sm">{p.place_name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPinned size={10}/>{p.road_address_name || p.address_name}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {newRes.name && <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl"><p className="font-bold text-sm">{newRes.name}</p><p className="text-xs text-slate-500 mt-0.5">{newRes.address}</p></div>}
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                  <input required className="w-full p-3 bg-white rounded-xl border border-orange-200 outline-none" style={{ fontSize: '16px' }} placeholder="식당 이름" value={newRes.name} onChange={e => setNewRes({...newRes, name: e.target.value})} />
                  <input required className="w-full p-3 bg-white rounded-xl border border-orange-200 outline-none" style={{ fontSize: '16px' }} placeholder="도로명 주소" value={newRes.address} onChange={e => setNewRes({...newRes, address: e.target.value})} />
                </div>
              )}
              <select className="w-full p-3 bg-slate-50 rounded-xl border outline-none" style={{ fontSize: '16px' }} value={newRes.category} onChange={e => setNewRes({...newRes, category: e.target.value})}>
                {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c}>{c}</option>)}
              </select>
              <div className="border-t pt-4 space-y-3">
                <div className="flex gap-1.5 justify-center">
                  {[1,2,3,4,5].map(i => <Star key={i} size={28} className={`cursor-pointer ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}
                </div>
                <input required className="w-full p-3 bg-slate-50 rounded-xl border outline-none" style={{ fontSize: '16px' }} placeholder="한 줄 평" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} />
                <input required className="w-full p-3 bg-slate-50 rounded-xl border outline-none" style={{ fontSize: '16px' }} placeholder="닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
              </div>
            </div>
            <div className="px-6 py-4 border-t shrink-0">
              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg active:scale-98 transition">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20}/> : "지도에 추가하기 🚀"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 모달: 리뷰 쓰기 ── */}
      {isReviewModalOpen && selectedRes && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-end justify-center z-50 backdrop-blur-sm">
          <form onSubmit={handleReviewSubmit} className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black">"{selectedRes.name}" 리뷰</h2>
              <button type="button" onClick={() => setIsReviewModalOpen(false)}><X className="text-slate-400" size={22} /></button>
            </div>
            <div className="flex gap-2 justify-center py-2">
              {[1,2,3,4,5].map(i => <Star key={i} size={36} className={`cursor-pointer ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}
            </div>
            <textarea required className="w-full p-3 bg-slate-50 rounded-xl border outline-none focus:border-orange-400 h-24"
              style={{ fontSize: '16px' }} placeholder="맛, 분위기는 어떠셨나요?"
              value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})}></textarea>
            <input required className="w-full p-3 bg-slate-50 rounded-xl border outline-none focus:border-orange-400"
              style={{ fontSize: '16px' }} placeholder="작성자 닉네임"
              value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setIsReviewModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm">취소</button>
              <button type="submit" disabled={isSubmitting} className="flex-[2] py-3 bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20}/> : "등록하기"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        .church-marker-label { background-color: white; color: #1e3a8a; font-size: 12px; padding: 3px 8px; border-radius: 8px; border: 2px solid #3b82f6; box-shadow: 0 2px 6px rgba(0,0,0,0.15); margin-top: -28px; white-space: nowrap; pointer-events: none; }
        .restaurant-marker-label { background-color: white; color: #ea580c; font-size: 12px; padding: 3px 8px; border-radius: 8px; border: 2px solid #f97316; box-shadow: 0 2px 6px rgba(0,0,0,0.15); margin-top: -28px; white-space: nowrap; pointer-events: none; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
