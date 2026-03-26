import React, { useState, useEffect, useRef } from 'react';
import {
  Star,
  MapPin,
  Utensils,
  Plus,
  Search,
  MessageSquare,
  X,
  Loader2,
  Map as MapIcon,
  Church,
  MapPinned,
  Navigation
} from 'lucide-react';

// 🌟 [설정] 구글 앱스 스크립트 URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdChOl5CumYzkX-rjai2BpD91BQBH193NrKLL2RRIvxGKJFRx0_Si0zIFM_BClJA5M/exec";

const App = () => {
  // --- [State 관리] ---
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRes, setSelectedRes] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');

  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // 맛집 등록/리뷰 상태
  const [newRes, setNewRes] = useState({ name: '', category: '한식', address: '' });
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', author: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualAddress, setIsManualAddress] = useState(false);

  // 식당 검색 관련 상태
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // 거리 정보 저장 (교회 기준)
  const [distances, setDistances] = useState({});

  // --- [Refs 관리] ---
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const geocodeCache = useRef({});
  const myLocMarkerRef = useRef(null);
  const listRef = useRef(null);

  // --- [모바일 바텀 시트 로직] ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const peekHeight = 160;
  const [sheetY, setSheetY] = useState(window.innerHeight - peekHeight);
  const touchStartRef = useRef({ y: 0, sheetY: 0 });
  const isSheetDraggingRef = useRef(false);

  const CHURCH_ADDRESS = "서울 강북구 노해로 50";
  const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '분식', '카페'];

  // --- [효과 관리] ---

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSheetY(0);
      else setSheetY(window.innerHeight - peekHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isAddModalOpen || isReviewModalOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
  }, [isAddModalOpen, isReviewModalOpen]);

  // --- 📱 [핵심 수정] 터치 이벤트 처리 (지도-시트 간섭 완전 해결) ---

  const onTouchStart = (e) => {
    if (!isMobile) return;

    // 🌟 전파 차단: 시트 위에서의 터치가 지도로 전달되지 않게 함
    e.stopPropagation();

    // 🌟 핸들 영역('-' 모양) 터치 여부 확인
    const isHandle = e.target.closest('.sheet-handle-area');

    touchStartRef.current.y = e.touches[0].clientY;
    touchStartRef.current.sheetY = sheetY;

    // 핸들을 잡았을 때만 시트 이동 모드 활성화
    if (isHandle) {
      isSheetDraggingRef.current = true;
    } else {
      isSheetDraggingRef.current = false;
    }
  };

  const onTouchMove = (e) => {
    if (!isMobile) return;

    // 시트 내부 터치가 지도를 움직이지 못하게 함
    e.stopPropagation();

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartRef.current.y;

    // 1. 핸들을 잡고 시트 높이를 조절할 때
    if (isSheetDraggingRef.current) {
      if (e.cancelable) e.preventDefault(); // 브라우저 스크롤 방지
      let newY = touchStartRef.current.sheetY + deltaY;
      newY = Math.max(60, Math.min(newY, window.innerHeight - peekHeight));
      setSheetY(newY);
    }
    // 2. 핸들이 아닌 리스트 내부를 스크롤할 때
    else {
      // 여기서는 시트를 움직이지 않고 리스트 자체의 스크롤이 작동하도록 둡니다.
      // 단, 리스트가 맨 위(scrollTop 0)에서 아래로 당길 때만 시트가 접히게 할 수 있습니다.
      const scrollTop = listRef.current ? listRef.current.scrollTop : 0;
      if (scrollTop <= 0 && deltaY > 0) {
        let newY = touchStartRef.current.sheetY + deltaY;
        newY = Math.max(60, Math.min(newY, window.innerHeight - peekHeight));
        setSheetY(newY);
      }
    }
  };

  const onTouchEnd = (e) => {
    if (!isMobile) return;
    e.stopPropagation();
    isSheetDraggingRef.current = false;

    // 자석 효과
    const snapThreshold = window.innerHeight * 0.45;
    if (sheetY < snapThreshold) {
      setSheetY(60);
    } else {
      setSheetY(window.innerHeight - peekHeight);
      if (listRef.current) listRef.current.scrollTop = 0;
    }
  };

  const mobileSheetStyle = isMobile ? {
    transform: `translateY(${sheetY}px)`,
    transition: isSheetDraggingRef.current ? 'none' : 'transform 0.3s ease-out',
    height: `calc(100vh - 60px)`,
  } : {};

  // --- [기능 함수들] ---

  const moveToMyLocation = () => {
    if (!navigator.geolocation) return alert("GPS를 지원하지 않는 기기입니다.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myPos = new window.google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        mapInstance.current.panTo(myPos);
        mapInstance.current.setZoom(17);
        if (myLocMarkerRef.current) myLocMarkerRef.current.setMap(null);
        myLocMarkerRef.current = new window.google.maps.Marker({
          position: myPos, map: mapInstance.current,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, fillColor: '#3B82F6', fillOpacity: 1, strokeWeight: 2, strokeColor: '#FFFFFF', scale: 7 }
        });
      },
      () => alert("위치 권한을 확인해주세요."), { enableHighAccuracy: true }
    );
  };

  const fetchRestaurants = async () => {
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();
      const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.restaurant]) {
          acc[curr.restaurant] = {
            id: curr.restaurant, name: curr.restaurant,
            address: curr.address || "", category: curr.category || "기타",
            reviews: [], avgRating: 0
          };
        }
        acc[curr.restaurant].reviews.push({
          rating: Number(curr.rating), comment: curr.comment,
          author: curr.author, timestamp: curr.timestamp
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
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchRestaurants(); }, []);

  const getCoordinates = (address, callback) => {
    if (geocodeCache.current[address]) return callback(geocodeCache.current[address]);
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: address }, (results, status) => {
      if (status === "OK") {
        geocodeCache.current[address] = results[0].geometry.location;
        callback(results[0].geometry.location);
      }
    });
  };

  useEffect(() => {
    if (loading || !window.google || !mapRef.current) return;
    if (!mapInstance.current) {
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
    }
  }, [loading, restaurants]);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (selectedRes) getCoordinates(selectedRes.address, (loc) => { mapInstance.current.panTo(loc); mapInstance.current.setZoom(17); });
    else getCoordinates(CHURCH_ADDRESS, (loc) => { mapInstance.current.panTo(loc); mapInstance.current.setZoom(16); });
  }, [selectedRes]);

  const filteredList = restaurants.filter(r => (r.name.includes(searchQuery) || r.address.includes(searchQuery)) && (activeCategory === '전체' || r.category === activeCategory));

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const reviewData = { restaurant: selectedRes.name, address: selectedRes.address, category: selectedRes.category, rating: newReview.rating, comment: newReview.comment, author: newReview.author, timestamp: new Date().toISOString() };
    const updatedRes = { ...selectedRes };
    updatedRes.reviews = [reviewData, ...updatedRes.reviews];
    updatedRes.avgRating = (updatedRes.reviews.reduce((sum, r) => sum + r.rating, 0) / updatedRes.reviews.length).toFixed(1);
    setSelectedRes(updatedRes);
    setRestaurants(prev => prev.map(r => r.id === updatedRes.id ? updatedRes : r));
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(reviewData) }); alert("등록 완료!"); } finally { setIsSubmitting(false); setIsReviewModalOpen(false); setNewReview({ rating: 5, comment: '', author: '' }); }
  };

  const searchPlaces = () => {
    if (!searchKeyword.trim()) return;
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
    if (!newRes.name || !newRes.address) return alert("식당 선택 필수");
    setIsSubmitting(true);
    const initialReview = { restaurant: newRes.name, address: newRes.address, category: newRes.category, rating: newReview.rating, comment: newReview.comment, author: newReview.author, timestamp: new Date().toISOString() };
    const newRestaurantData = { id: newRes.name, name: newRes.name, address: newRes.address, category: newRes.category, avgRating: newReview.rating.toFixed(1), reviews: [initialReview] };
    setRestaurants([newRestaurantData, ...restaurants]);
    setSelectedRes(newRestaurantData);
    try { await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(initialReview) }); alert("추가 완료!"); } finally { setIsSubmitting(false); setIsAddModalOpen(false); setNewRes({ name: '', category: '한식', address: '' }); setNewReview({ rating: 5, comment: '', author: '' }); setIsManualAddress(false); }
  };

  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 flex flex-col overflow-hidden">

      <header className="fixed top-0 left-0 w-full z-30 lg:static bg-white/95 border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-md lg:shadow-none">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl shadow-md"><Utensils className="text-white" size={20} /></div>
          <h1 className="text-lg lg:text-xl font-black tracking-tight">성실 맛집 <span className="text-orange-500">Map</span></h1>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs lg:text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-all">
          <Plus size={16} /> 새 맛집 제보
        </button>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative pt-[73px] lg:pt-0">

        {/* --- 🗺️ 지도 구역 --- */}
        <section className="absolute inset-0 z-0 lg:static lg:w-1/2 lg:h-full bg-slate-200">
          <div ref={mapRef} className="w-full h-full" />

          <button onClick={moveToMyLocation} className="absolute right-4 bottom-[180px] lg:bottom-6 z-10 bg-white p-3.5 rounded-full shadow-2xl border border-slate-100 active:bg-slate-100 transition-all">
            <Navigation size={22} className="fill-slate-700" />
          </button>

          {selectedRes && (
            <div className="absolute transition-all duration-300 left-1/2 -translate-x-1/2 z-10" style={{ bottom: isMobile ? `calc(100vh - ${sheetY}px - 60px)` : '1.5rem' }}>
              <a href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedRes.name + " 수유동")}`} target="_blank" rel="noreferrer" className="bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs lg:text-base hover:bg-green-700 transition scale-90 lg:scale-100">
                <MapIcon size={18} /> 네이버 길찾기
              </a>
            </div>
          )}
        </section>

        {/* --- 📝 바텀 시트 (리스트/상세) --- */}
        <section
          className="fixed bottom-0 left-0 w-full z-20 bg-white rounded-t-[32px] lg:rounded-none shadow-2xl flex flex-col lg:static lg:w-1/2 lg:h-full lg:shadow-none lg:border-l lg:border-slate-200 overflow-hidden"
          style={mobileSheetStyle}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* 🌟 드래그 핸들: 이 부분을 스크롤할 때만 시트가 움직임 */}
          <div className="sheet-handle-area lg:hidden w-full p-5 flex justify-center items-center cursor-ns-resize shrink-0">
            <div className="w-14 h-1.5 bg-slate-200 rounded-full"></div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 shrink-0 bg-white">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                <input type="text" placeholder="식당 이름이나 주소 검색..." className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl outline-none focus:ring-2 focus:ring-orange-400 text-base lg:text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-2 mt-3 overflow-x-auto custom-scrollbar pb-1">
                {CATEGORIES.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm border ${activeCategory === cat ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}>{cat}</button>)}
              </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              {/* 리스트 목록 */}
              <div ref={listRef} className={`w-full lg:w-2/5 shrink-0 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-slate-50/50 transition-all ${selectedRes && isMobile ? 'invisible opacity-0' : 'visible opacity-100'}`} style={{ overscrollBehavior: 'contain' }}>
                {activeCategory === '전체' && (
                  <button onClick={() => setSelectedRes(null)} className="w-full text-left p-4 rounded-2xl border-2 bg-blue-50 border-blue-200 mb-2">
                    <h3 className="font-bold text-blue-900 text-sm">수유 성실교회</h3><p className="text-[11px] text-blue-500 mt-1">우리들의 베이스캠프 ⛪</p>
                  </button>
                )}
                {filteredList.map(res => (
                  <div key={res.id} onClick={() => setSelectedRes(res)} className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400' : 'bg-white border-transparent shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="font-bold text-slate-900 text-sm truncate">{res.name}</h3>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{res.category}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                      <Star size={14} className="fill-orange-400 text-orange-400" /> {res.avgRating}
                      {distances[res.id] && <span className="ml-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">⛪ 교회에서 {distances[res.id] < 1000 ? `${Math.round(distances[res.id])}m` : `${(distances[res.id] / 1000).toFixed(1)}km`}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* 상세 화면 */}
              <div className={`w-full lg:w-3/5 shrink-0 overflow-y-auto custom-scrollbar p-6 bg-white transition-all duration-300 ${selectedRes ? 'absolute inset-0 lg:static translate-x-0' : 'absolute inset-0 lg:static translate-x-full lg:translate-x-0'}`} style={{ overscrollBehavior: 'contain' }}>
                {selectedRes && (
                  <>
                    <div className="flex justify-between items-start mb-6 pb-5 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-bold text-orange-600 bg-orange-100 px-2.5 py-1 rounded-md">{selectedRes.category}</span>
                        <h2 className="text-2xl font-black text-slate-900 mt-2.5">{selectedRes.name}</h2>
                        <div className="flex flex-col gap-1.5 mt-2.5">
                           <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={13}/>{selectedRes.address}</p>
                           {distances[selectedRes.id] && <p className="text-xs font-bold text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-lg">⛪ 성실교회에서 {Math.round(distances[selectedRes.id])}m 거리에 위치</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedRes(null)} className="lg:hidden p-2 text-slate-400"><X size={24}/></button>
                        <button onClick={() => setIsReviewModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md">리뷰 남기기</button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {selectedRes.reviews.map((r, i) => (
                        <div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-center mb-2.5">
                            <span className="font-bold text-sm text-slate-800">{r.author}</span>
                            <div className="flex gap-0.5">{[1,2,3,4,5].map(num => <Star key={num} size={12} className={num <= r.rating ? "fill-orange-400 text-orange-400" : "text-slate-200"} />)}</div>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed bg-white/50 p-3 rounded-xl">{r.comment}</p>
                          <p className="text-[10px] text-slate-400 mt-3">{new Date(r.timestamp).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 모달: 새 맛집 등록 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-[32px] w-full max-w-md p-7 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-2 border-b">
              <h2 className="text-xl font-black">새 맛집 제보하기</h2>
              <X className="cursor-pointer text-slate-400" onClick={() => setIsAddModalOpen(false)} />
            </div>
            <div className="overflow-y-auto flex-1 space-y-5 py-3 custom-scrollbar">
              <div className="flex justify-end"><label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded text-orange-500" checked={isManualAddress} onChange={(e) => setIsManualAddress(e.target.checked)} />직접 주소 입력</label></div>
              {!isManualAddress ? (
                <div className="bg-slate-50 p-5 rounded-2xl border space-y-3">
                  <div className="flex gap-2">
                    <input type="text" className="flex-1 p-3.5 bg-white rounded-xl border outline-none text-base lg:text-sm" placeholder="예: 수유리 우동집" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchPlaces())} />
                    <button type="button" onClick={searchPlaces} className="px-5 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs">{isSearching ? <Loader2 className="animate-spin" size={18}/> : '검색'}</button>
                  </div>
                  {searchResults.length > 0 && <ul className="max-h-48 overflow-y-auto bg-white border rounded-xl divide-y shadow-inner">{searchResults.map(place => <li key={place.id} onClick={() => handleSelectPlace(place)} className="p-3.5 hover:bg-orange-50 cursor-pointer text-sm font-bold">{place.place_name}<br/><span className="text-[11px] font-normal text-slate-400">{place.address_name}</span></li>)}</ul>}
                  {newRes.name && <div className="p-3.5 bg-orange-100 rounded-xl border border-orange-200"><p className="font-bold text-slate-900 text-sm">{newRes.name}</p><p className="text-xs text-slate-600">{newRes.address}</p></div>}
                </div>
              ) : (
                <div className="space-y-4 p-5 bg-orange-50 rounded-2xl border">
                  <input required className="w-full p-3.5 rounded-xl border text-base lg:text-sm" placeholder="식당 이름" value={newRes.name} onChange={e => setNewRes({...newRes, name: e.target.value})} />
                  <input required className="w-full p-3.5 rounded-xl border text-base lg:text-sm" placeholder="도로명 주소" value={newRes.address} onChange={e => setNewRes({...newRes, address: e.target.value})} />
                </div>
              )}
              <select className="w-full p-3.5 bg-slate-50 rounded-xl border text-base lg:text-sm" value={newRes.category} onChange={e => setNewRes({...newRes, category: e.target.value})}>{CATEGORIES.filter(c => c !== '전체').map(c => <option key={c}>{c}</option>)}</select>
              <div className="pt-5 border-t space-y-4">
                <div className="flex gap-2 justify-center">{[1, 2, 3, 4, 5].map(i => <Star key={i} size={32} className={`cursor-pointer transition ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}</div>
                <input required className="w-full p-3.5 bg-slate-50 rounded-xl border text-base lg:text-sm" placeholder="한 줄 평" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} />
                <input required className="w-full p-3.5 bg-slate-50 rounded-xl border text-base lg:text-sm" placeholder="닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full py-4.5 bg-orange-500 text-white rounded-2xl font-bold shadow-lg">{isSubmitting ? <Loader2 className="animate-spin m-auto" size={22}/> : "등록하기 🚀"}</button>
          </form>
        </div>
      )}

      {isReviewModalOpen && selectedRes && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form onSubmit={handleReviewSubmit} className="bg-white rounded-[32px] w-full max-w-sm p-7 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center"><h2 className="text-xl font-black">리뷰 남기기</h2><X className="cursor-pointer text-slate-400" onClick={() => setIsReviewModalOpen(false)} /></div>
            <div className="flex-1 overflow-y-auto space-y-5 py-2 custom-scrollbar">
              <div className="flex gap-2.5 justify-center py-2">{[1, 2, 3, 4, 5].map(i => <Star key={i} size={38} className={`cursor-pointer ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}</div>
              <textarea required className="w-full p-4 bg-slate-50 rounded-2xl border h-36 text-base lg:text-sm" placeholder="솔직한 평가!" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})}></textarea>
              <input required className="w-full p-4 bg-slate-50 rounded-2xl border text-base lg:text-sm" placeholder="닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold">{isSubmitting ? <Loader2 className="animate-spin m-auto" size={20}/> : "등록하기"}</button>
          </form>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .church-marker-label { background-color: white; color: #1e3a8a; font-size: 13px; padding: 5px 12px; border-radius: 10px; border: 2.5px solid #3b82f6; box-shadow: 0 4px 10px rgba(0,0,0,0.15); margin-top: -32px; white-space: nowrap; pointer-events: none; }
        .restaurant-marker-label { background-color: white; color: #ea580c; font-size: 13px; padding: 5px 12px; border-radius: 10px; border: 2.5px solid #f97316; box-shadow: 0 4px 10px rgba(0,0,0,0.15); margin-top: -32px; white-space: nowrap; pointer-events: none; }
        @media (max-width: 1023px) { .custom-scrollbar::-webkit-scrollbar { display: none; } }
        input, select, textarea { font-size: 16px !important; }
      `}</style>
    </div>
  );
};

export default App;