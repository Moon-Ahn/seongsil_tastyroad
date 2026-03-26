import React, { useState, useEffect, useRef } from 'react';
import {
  Star, MapPin, Utensils, Plus, Search, MessageSquare,
  X, Loader2, Map as MapIcon, Church, MapPinned, Navigation,
  Coffee, Sun, Heart, ChevronDown, Trophy, Dices, CheckCircle,
  ChevronUp // 🌟 위로 화살표 추가
} from 'lucide-react';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9iIJhdFWfG70E8t0Gm0FwtATNMQiAusfY3uG2zlK3vQ9waszakr0jTQaG1n0iPkzh/exec";

const App = () => {
  // --- [상태 관리] ---
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRes, setSelectedRes] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [isSortByRating, setIsSortByRating] = useState(false);
  const [isCuisineOpen, setIsCuisineOpen] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isRankModalOpen, setIsRankModalOpen] = useState(false);

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
  const markersRef = useRef({});
  const geocodeCache = useRef({});
  const myLocMarkerRef = useRef(null);
  const cuisineRef = useRef(null);

  const CHURCH_ADDRESS = "서울 강북구 노해로 50";
  const CUISINES = ['한식', '중식', '일식', '양식', '분식', '동남아'];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (cuisineRef.current && !cuisineRef.current.contains(e.target)) setIsCuisineOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { if (selectedRes && isMobile) setIsSheetExpanded(true); }, [selectedRes, isMobile]);

  const toggleSheet = () => setIsSheetExpanded(!isSheetExpanded);
  const blockMap = (e) => { if (isMobile) e.stopPropagation(); };

  // --- [데이터 및 필터링] ---
  const filteredList = restaurants.filter(r => {
    const matchesSearch = r.name.includes(searchQuery) || r.address.includes(searchQuery);
    let matchesCategory = (activeCategory === '전체') || (activeCategory === '점심추천' && r.isLunch) || (activeCategory === '심방추천' && r.isVisitation) || (activeCategory === '인증맛집' && r.isCertified) || (r.category === activeCategory);
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (isSortByRating) return Number(b.avgRating) - Number(a.avgRating);
    return (distances[a.id] || 999999) - (distances[b.id] || 999999);
  });

  useEffect(() => {
    if (!mapInstance.current) return;
    Object.keys(markersRef.current).forEach(resId => {
      const isVisible = filteredList.some(r => r.id === resId);
      markersRef.current[resId].setMap(isVisible ? mapInstance.current : null);
    });
  }, [activeCategory, searchQuery, restaurants, isSortByRating]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        const grouped = data.reduce((acc, curr) => {
          const resName = curr.restaurant;
          const checkMark = (val) => val && (val.toString().trim().toLowerCase() === 'o' || val.toString().trim() === 'ㅇ');
          if (!acc[resName]) {
            acc[resName] = { id: resName, name: resName, address: curr.address || "", category: curr.category || "기타", isLunch: checkMark(curr.isLunch), isVisitation: checkMark(curr.isVisitation), reviews: [], avgRating: 0 };
          } else {
            if (checkMark(curr.isLunch)) acc[resName].isLunch = true;
            if (checkMark(curr.isVisitation)) acc[resName].isVisitation = true;
          }
          acc[resName].reviews.push({ rating: Number(curr.rating), comment: curr.comment, author: curr.author, timestamp: curr.timestamp });
          return acc;
        }, {});
        const list = Object.values(grouped).map(r => {
          r.avgRating = (r.reviews.reduce((s, v) => s + v.rating, 0) / r.reviews.length).toFixed(1);
          r.reviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          r.isCertified = r.reviews.length >= 5 && Number(r.avgRating) >= 4.0;
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

  const getPinIcon = (color) => ({
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
    fillColor: color, fillOpacity: 1, strokeWeight: 2, strokeColor: '#FFFFFF', scale: 1.3,
    anchor: new window.google.maps.Point(12, 22), labelOrigin: new window.google.maps.Point(12, -10)
  });

  useEffect(() => {
    if (loading || !window.google || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      zoom: 16, mapTypeControl: false, streetViewControl: false, disableDefaultUI: true,
      styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }, { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }]
    });
    getCoordinates(CHURCH_ADDRESS, (churchLoc) => {
      mapInstance.current.setCenter(churchLoc);
      new window.google.maps.Marker({ map: mapInstance.current, position: churchLoc, title: "성실교회", icon: getPinIcon('#FB7185'), label: { text: "수유 성실교회", className: "church-marker-label" } });
      restaurants.forEach(res => {
        getCoordinates(res.address, (loc) => {
          const themeColor = res.category === '카페' ? '#F97316' : '#1E293B';
          let labelClass = res.category === '카페' ? 'cafe-marker-label' : 'restaurant-marker-label';
          if (res.isCertified) labelClass += ' certified-border';
          const marker = new window.google.maps.Marker({
            map: mapInstance.current, position: loc, title: res.name, icon: getPinIcon(themeColor),
            label: { text: `${res.name}${res.isCertified ? ' 🏅' : ''} ★${res.avgRating}`, className: labelClass }
          });
          marker.addListener("click", () => { setSelectedRes(res); });
          markersRef.current[res.id] = marker;
          if (window.google.maps.geometry) {
            setDistances(prev => ({ ...prev, [res.id]: window.google.maps.geometry.spherical.computeDistanceBetween(churchLoc, loc) }));
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
    if (!navigator.geolocation) return alert("GPS 권한 필요");
    navigator.geolocation.getCurrentPosition((pos) => {
      const myPos = new window.google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
      mapInstance.current.panTo(myPos); mapInstance.current.setZoom(17);
      if (myLocMarkerRef.current) myLocMarkerRef.current.setMap(null);
      myLocMarkerRef.current = new window.google.maps.Marker({ position: myPos, map: mapInstance.current, icon: { path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#3B82F6', fillOpacity: 1, strokeWeight: 3, strokeColor: '#FFF', scale: 8 } });
    });
  };

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

  const handleSelectPlace = (p) => { setNewRes({ ...newRes, name: p.place_name, address: p.road_address_name || p.address_name }); setSearchResults([]); setSearchKeyword(''); };

  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRes.name || !newRes.address) return alert("식당 선택 필수");
    setIsSubmitting(true);
    const initialReview = { restaurant: newRes.name, address: newRes.address, category: newRes.category, rating: newReview.rating, comment: newReview.comment, author: newReview.author, timestamp: new Date().toISOString() };
    const newData = { id: newRes.name, name: newRes.name, address: newRes.address, category: newRes.category, avgRating: newReview.rating.toFixed(1), reviews: [initialReview], isLunch: false, isVisitation: false };
    setRestaurants([newData, ...restaurants]); setSelectedRes(newData);
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(initialReview) }); alert("맛집 등록 완료!"); }
    finally { setIsSubmitting(false); setIsAddModalOpen(false); setNewRes({ name: '', category: '한식', address: '' }); setNewReview({ rating: 5, comment: '', author: '' }); setIsManualAddress(false); }
  };

  if (loading) return <div className="h-screen h-[100dvh] flex items-center justify-center bg-white"><Loader2 className="animate-spin text-rose-400" size={40} /></div>;

  return (
    <div className="h-screen h-[100dvh] w-screen overflow-hidden flex flex-col lg:flex-row bg-white font-sans">

      <div className="relative flex-1 h-1/2 lg:h-full order-1 lg:order-2 overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="flex-1 lg:max-w-xs bg-white rounded-2xl shadow-xl flex items-center px-4 py-3 gap-3 pointer-events-auto border border-slate-100">
              <div className="bg-orange-500 p-1.5 rounded-lg shrink-0 shadow-sm"><Utensils className="text-white" size={14} /></div>
              <span className="font-black text-sm text-slate-800 tracking-tight">성실 맛집 <span className="text-orange-500">Map</span></span>
            </div>
            <button onClick={() => {
                const onlyFood = restaurants.filter(r => r.category !== '카페');
                if (onlyFood.length === 0) return alert("식당 데이터가 없습니다.");
                const random = onlyFood[Math.floor(Math.random() * onlyFood.length)];
                setSelectedRes(random);
            }} className="bg-white text-slate-700 w-11 h-11 rounded-2xl shadow-xl flex items-center justify-center shrink-0 active:scale-95 transition pointer-events-auto border border-slate-100"><Dices size={20} className="text-orange-500" /></button>
            <button onClick={() => setIsRankModalOpen(true)} className="bg-white text-slate-700 w-11 h-11 rounded-2xl shadow-xl flex items-center justify-center shrink-0 active:scale-95 transition pointer-events-auto border border-slate-100"><Trophy size={20} className="text-yellow-500" /></button>
            <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-500 text-white w-11 h-11 rounded-2xl shadow-xl flex items-center justify-center shrink-0 active:scale-95 transition pointer-events-auto border-2 border-white"><Plus size={22} /></button>
          </div>
          <div className="flex gap-2 pointer-events-auto overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setActiveCategory(activeCategory === '점심추천' ? '전체' : '점심추천')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl shadow-lg font-bold text-[11px] whitespace-nowrap transition-all active:scale-95 ${activeCategory === '점심추천' ? 'bg-slate-800 text-white' : 'bg-white text-slate-800 border border-slate-100'}`}><Sun size={14} /> 점심먹기 좋은 곳</button>
            <button onClick={() => setActiveCategory(activeCategory === '심방추천' ? '전체' : '심방추천')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl shadow-lg font-bold text-[11px] whitespace-nowrap transition-all active:scale-95 ${activeCategory === '심방추천' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-100'}`}><Heart size={14} /> 심방하기 좋은 곳</button>
            <button onClick={() => setActiveCategory(activeCategory === '인증맛집' ? '전체' : '인증맛집')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl shadow-lg font-bold text-[11px] whitespace-nowrap transition-all active:scale-95 ${activeCategory === '인증맛집' ? 'bg-yellow-500 text-white shadow-yellow-200' : 'bg-white text-yellow-600 border border-yellow-100'}`}><CheckCircle size={14} /> 성실인증 맛집</button>
          </div>
        </div>
        <button onClick={moveToMyLocation} className="absolute right-4 z-10 bg-white p-3.5 rounded-full shadow-2xl border active:scale-90 transition-all duration-300" style={{ bottom: isMobile ? (isSheetExpanded ? 'calc(100dvh - 60px + 20px)' : '180px') : '2rem' }}><Navigation size={22} className="text-slate-700" /></button>
      </div>

      {/* 📝 바텀 시트 (개선된 클릭 유도 디자인) */}
      <section
        className={`z-20 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.12)] flex flex-col transition-all duration-500 ease-in-out
                    ${isMobile ? 'fixed left-0 right-0 bottom-0 rounded-t-[32px]' : 'relative w-[400px] h-full shadow-none border-r border-slate-100'}`}
        style={isMobile ? { transform: `translateY(${isSheetExpanded ? '60px' : 'calc(100dvh - 160px)'})`, height: 'calc(100dvh - 60px)' } : {}}
      >
        {/* 🌟 [개선] 클릭을 유도하는 핸들 버튼 디자인 */}
        {isMobile && (
          <div onClick={toggleSheet} className="w-full pt-2 pb-3 flex flex-col justify-center items-center shrink-0 cursor-pointer active:bg-slate-50 transition-colors">
            {/* 화살표 애니메이션 */}
            <div className={`transition-all duration-300 ${isSheetExpanded ? 'rotate-180 mb-1' : 'animate-bounce mt-1'}`}>
              {isSheetExpanded ? <ChevronDown size={24} className="text-slate-300" /> : <ChevronUp size={24} className="text-orange-400" />}
            </div>
            {/* 안내 텍스트 */}
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
               {isSheetExpanded ? "Tap to see map" : "Tap to see list"}
            </span>
          </div>
        )}

        <div className={`flex-1 flex flex-col overflow-hidden ${selectedRes && isMobile && isSheetExpanded ? 'hidden' : 'flex'}`}>
          <div className="px-4 pb-3 border-b border-slate-50 shrink-0 bg-white">
            <div className="relative mt-1">
              <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
              <input type="text" placeholder="맛집 이름, 주소 검색..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-orange-400 text-base lg:text-sm transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 mt-3 relative">
              <button onClick={() => { setActiveCategory('전체'); setIsSortByRating(false); }} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${activeCategory === '전체' ? 'bg-orange-500 text-white' : 'bg-white text-slate-500'}`}>전체</button>
              <div className="relative" ref={cuisineRef}>
                <button onClick={() => setIsCuisineOpen(!isCuisineOpen)} className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${CUISINES.includes(activeCategory) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600'}`}>
                  {CUISINES.includes(activeCategory) ? activeCategory : '요리 분류'} <ChevronDown size={14} className={`transition-transform ${isCuisineOpen ? 'rotate-180' : ''}`} />
                </button>
                {isCuisineOpen && (
                  <div className="absolute top-full left-0 mt-2 w-32 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                    {CUISINES.map(c => (
                      <button key={c} onClick={() => { setActiveCategory(c); setIsCuisineOpen(false); }} className={`w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 transition-colors ${activeCategory === c ? 'text-orange-500' : 'text-slate-600'}`}>{c}</button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setActiveCategory('카페')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${activeCategory === '카페' ? 'bg-orange-500 text-white' : 'bg-white text-slate-500'}`}>카페</button>
              <button onClick={() => setIsSortByRating(!isSortByRating)} className={`ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSortByRating ? 'text-orange-500 bg-orange-50' : 'text-slate-400 bg-slate-50'}`}>
                <Star size={14} className={isSortByRating ? 'fill-orange-400' : ''} /> 별점순
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-white overscroll-none scrolling-touch" onTouchStart={blockMap}>
            {activeCategory === '전체' && <button onClick={() => setSelectedRes(null)} className="w-full text-left p-4 rounded-3xl bg-pink-50/50 border border-pink-100 shadow-sm active:scale-95 transition-all"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-pink-100 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"><Church size={18} className="text-rose-400" /></div><div><h3 className="font-bold text-rose-500 text-sm">수유 성실교회</h3><p className="text-[11px] text-rose-300 font-medium">우리들의 베이스캠프 ⛪</p></div></div></button>}
            {filteredList.map(res => (
              <div key={res.id} onClick={() => setSelectedRes(res)} className={`p-4 rounded-3xl cursor-pointer border-2 transition-all active:scale-98 ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400 shadow-md' : 'bg-white border-slate-50 shadow-sm hover:shadow-md'} ${res.isCertified ? 'border-yellow-400 border-[2.5px]' : ''}`}>
                <div className="flex items-center justify-between mb-2"><h3 className="font-bold text-slate-900 text-sm truncate pr-2">{res.name}{res.isCertified && ' 🏅'}</h3><span className={`text-[10px] px-2.5 py-1 rounded-full font-bold shrink-0 ${res.category === '카페' ? 'bg-orange-100 text-orange-600' : 'bg-slate-800 text-white'}`}>{res.category}</span></div>
                <div className="flex items-center gap-2"><div className="flex items-center gap-0.5 bg-white border border-slate-100 px-2 py-0.5 rounded-full shadow-sm"><Star size={12} className="fill-orange-400 text-orange-400" /><span className="text-xs font-black text-slate-700">{res.avgRating}</span></div>{distances[res.id] && <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">⛪ {Math.round(distances[res.id])}m</span>}</div>
              </div>
            ))}
          </div>
        </div>

        {selectedRes && isSheetExpanded && (
          <div className={`flex-1 flex flex-col overflow-hidden bg-white ${isMobile ? '' : 'absolute inset-0 z-30'}`}>
            <div className="px-5 pt-2 pb-5 border-b border-slate-50 shrink-0">
              <div className="flex justify-between items-start"><div className="flex-1 min-w-0 pr-4"><span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${selectedRes.category === '카페' ? 'bg-orange-100 text-orange-600' : 'bg-slate-800 text-white'}`}>{selectedRes.category}</span><h2 className="text-2xl font-black text-slate-900 mt-2 leading-tight truncate">{selectedRes.name}{selectedRes.isCertified && ' 🏅'}</h2><div className="mt-3 space-y-1.5"><p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium"><MapPin size={13} className="text-orange-400" />{selectedRes.address}</p>{distances[selectedRes.id] && <p className="text-xs font-bold text-blue-600 bg-blue-50 w-fit px-3 py-1 rounded-full shadow-sm flex items-center gap-1">⛪ 성실교회에서 {Math.round(distances[selectedRes.id])}m 거리</p>}</div></div><button onClick={() => setSelectedRes(null)} className="p-2.5 bg-slate-100 rounded-full active:scale-90 transition-all"><X size={20} className="text-slate-500" /></button></div>
              <div className="flex gap-2.5 mt-5"><a href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedRes.name + " 수유동")}`} target="_blank" rel="noreferrer" className="flex-1 bg-green-500 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition shadow-green-100"><MapIcon size={16} /> 길찾기</a><button onClick={() => setIsReviewModalOpen(true)} className="flex-1 bg-slate-900 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition shadow-slate-200"><MessageSquare size={16} /> 리뷰 쓰기</button></div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-white overscroll-none scrolling-touch" onTouchStart={blockMap}><h4 className="font-black text-slate-800 text-sm ml-1">청년부 리뷰 <span className="text-orange-500">{selectedRes.reviews.length}</span></h4>{selectedRes.reviews.length === 0 ? <p className="text-center text-slate-400 text-xs py-14 font-medium">아직 리뷰가 없어요. 첫 리뷰를 남겨주세요! ✨</p> : selectedRes.reviews.map((r, i) => (<div key={i} className="bg-slate-50/50 p-5 rounded-[24px] shadow-sm border border-slate-100"><div className="flex justify-between items-center mb-3"><span className="font-bold text-sm text-slate-800">{r.author}</span><div className="flex gap-0.5">{[1,2,3,4,5].map(n => <Star key={n} size={11} className={n <= r.rating ? "fill-orange-400 text-orange-400" : "text-slate-200"} />)}</div></div><p className="text-sm text-slate-600 leading-relaxed font-medium">{r.comment}</p><p className="text-[10px] text-slate-400 mt-3.5 text-right font-bold">{new Date(r.timestamp).toLocaleDateString()}</p></div>)) }</div>
          </div>
        )}
      </section>

      {/* --- 모달들은 동일하게 유지 --- */}
      {isRankModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[100] backdrop-blur-md p-4" onClick={() => setIsRankModalOpen(false)}>
          <div className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-8 text-center text-white relative">
              <button onClick={() => setIsRankModalOpen(false)} className="absolute top-4 right-4 bg-white/20 p-1.5 rounded-full hover:bg-white/30 transition-colors"><X size={20}/></button>
              <Trophy size={48} className="mx-auto mb-3 drop-shadow-lg" />
              <h2 className="text-2xl font-black italic tracking-tighter">THANK YOU</h2>
              <p className="text-sm font-bold opacity-90 mt-1">{new Date().getMonth() + 1}월의 맛집 전도사 TOP 3</p>
            </div>
            <div className="p-6 space-y-4">
              {Object.entries(restaurants.reduce((acc, res) => {
                res.reviews.forEach(rev => {
                  const d = new Date(rev.timestamp);
                  if (d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear()) {
                    acc[rev.author] = (acc[rev.author] || 0) + 1;
                  }
                });
                return acc;
              }, {})).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 3).map((user, i) => (
                <div key={i} className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all ${i === 0 ? 'bg-yellow-50 border-yellow-200 scale-105' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                  <span className="flex-1 font-black text-slate-800 text-lg">{user.name}</span>
                  <span className="font-bold text-orange-600 bg-orange-100 px-4 py-1.5 rounded-full text-sm">{user.count}건</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 맛집 추가 및 리뷰 모달 생략(위와 동일) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-[40px] w-full max-w-md flex flex-col shadow-2xl" style={{ maxHeight: '90dvh' }}>
            <div className="flex justify-between items-center px-7 py-6 border-b shrink-0"><h2 className="text-xl font-black text-slate-900">새 맛집 제보 🥘</h2><button type="button" onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button></div>
            <div className="overflow-y-auto flex-1 px-7 py-6 space-y-6 no-scrollbar">
              <div className="flex justify-end"><label className="flex items-center gap-2 text-xs font-bold text-orange-500 cursor-pointer bg-orange-50 px-3 py-1.5 rounded-full"><input type="checkbox" className="w-4 h-4 rounded-md accent-orange-500" checked={isManualAddress} onChange={(e) => setIsManualAddress(e.target.checked)} /> 직접 주소 입력</label></div>
              {!isManualAddress ? (
                <div className="bg-slate-50 p-5 rounded-[28px] border border-slate-100 space-y-4 shadow-inner">
                  <div className="flex gap-2">
                    <input type="text" className="flex-1 p-3.5 bg-white rounded-2xl border-none shadow-sm outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="예: 수유리 우동집" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchPlaces())} />
                    <button type="button" onClick={searchPlaces} className="px-5 py-3.5 bg-slate-800 text-white rounded-2xl font-black text-xs active:scale-95 transition-all shadow-lg">{isSearching ? <Loader2 className="animate-spin" size={18}/> : '검색'}</button>
                  </div>
                  {searchResults.length > 0 && <ul className="max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-2xl divide-y no-scrollbar shadow-xl">{searchResults.map(p => <li key={p.id} onClick={() => handleSelectPlace(p)} className="p-4 hover:bg-orange-50 cursor-pointer transition-colors active:bg-orange-100"><div className="font-black text-sm text-slate-800">{p.place_name}</div><div className="text-[11px] font-bold text-slate-400 mt-1">{p.address_name}</div></li>)}</ul>}
                  {newRes.name && <div className="p-4 bg-white rounded-2xl border-2 border-orange-400 shadow-md animate-pulse"><p className="font-black text-orange-600 text-sm">{newRes.name}</p><p className="text-[11px] text-slate-500 font-bold mt-1">{newRes.address}</p></div>}
                </div>
              ) : (
                <div className="space-y-3 p-5 bg-orange-50/50 rounded-[28px] border-2 border-orange-100">
                  <input required className="w-full p-4 rounded-2xl border-none shadow-sm outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="식당 이름" value={newRes.name} onChange={e => setNewRes({...newRes, name: e.target.value})} />
                  <input required className="w-full p-4 rounded-2xl border-none shadow-sm outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="도로명 주소" value={newRes.address} onChange={e => setNewRes({...newRes, address: e.target.value})} />
                </div>
              )}
              <div className="space-y-4">
                 <div><select className="w-full mt-2 p-4 bg-slate-50 rounded-2xl outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" value={newRes.category} onChange={e => setNewRes({...newRes, category: e.target.value})}>{['한식', '중식', '일식', '양식', '분식', '동남아', '카페', '기타'].map(c => <option key={c}>{c}</option>)}</select></div>
                 <div className="pt-4 border-t border-slate-100 space-y-5 text-center">
                    <p className="text-sm font-black text-slate-700">첫 리뷰 남기기 ✨</p>
                    <div className="flex gap-2.5 justify-center">{[1,2,3,4,5].map(i => <Star key={i} size={32} className={`cursor-pointer transition-all hover:scale-125 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}</div>
                    <input required className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="이 맛집의 한 줄 평은?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} />
                    <input required className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-base lg:text-sm focus:ring-2 focus:ring-orange-400" placeholder="작성자 닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
                 </div>
              </div>
            </div>
            <div className="p-7 border-t shrink-0 bg-white rounded-b-[40px]"><button type="submit" disabled={isSubmitting} className="w-full py-4.5 bg-orange-500 text-white rounded-[24px] font-black shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={20}/> : "맛집 등록 완료 🚀"}</button></div>
          </form>
        </div>
      )}

      {isReviewModalOpen && selectedRes && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <form onSubmit={handleReviewSubmit} className="bg-white rounded-[40px] w-full max-w-sm p-8 space-y-6 shadow-2xl">
            <h2 className="text-xl font-black text-center text-slate-800">"{selectedRes.name}" <br/>리뷰 남기기 ✍️</h2>
            <div className="flex gap-2.5 justify-center py-2">{[1,2,3,4,5].map(i => <Star key={i} size={38} className={`cursor-pointer transition-all hover:scale-125 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}</div>
            <textarea required className="w-full p-4 bg-slate-50 rounded-[24px] shadow-inner h-36 text-base lg:text-sm outline-none focus:ring-2 focus:ring-orange-400" placeholder="맛, 분위기는 어땠나요?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})}></textarea>
            <input required className="w-full p-4 bg-slate-50 rounded-2xl shadow-inner text-base lg:text-sm outline-none focus:ring-2 focus:ring-orange-400" placeholder="닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
            <div className="flex gap-3 pt-2"><button type="button" onClick={() => setIsReviewModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm transition-colors">취소</button><button type="submit" disabled={isSubmitting} className="flex-[2] py-4 bg-orange-500 text-white rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all">{isSubmitting ? <Loader2 className="animate-spin m-auto" size={20}/> : "등록하기"}</button></div>
          </form>
        </div>
      )}

      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .restaurant-marker-label { background-color: white; color: #1e293b; font-size: 11px; padding: 4px 10px; border-radius: 10px; border: 2.2px solid #1e293b; box-shadow: 0 4px 10px rgba(0,0,0,0.18); margin-top: -32px; white-space: nowrap; pointer-events: none; font-weight: 800; }
        .cafe-marker-label { background-color: white; color: #f97316; font-size: 11px; padding: 4px 10px; border-radius: 10px; border: 2.2px solid #f97316; box-shadow: 0 4px 10px rgba(249,115,22,0.18); margin-top: -32px; white-space: nowrap; pointer-events: none; font-weight: 800; }
        .church-marker-label { background-color: white; color: #FB7185; font-size: 11px; padding: 5px 12px; border-radius: 10px; border: 2.5px solid #FB7185; box-shadow: 0 4px 10px rgba(251,113,133,0.2); margin-top: -32px; white-space: nowrap; pointer-events: none; font-weight: 900; }
        .certified-border { border: 2.5px solid #D4AF37 !important; box-shadow: 0 0 15px rgba(212, 175, 55, 0.4) !important; }
        input, select, textarea { font-size: 16px !important; }
      `}</style>
    </div>
  );
};

export default App;