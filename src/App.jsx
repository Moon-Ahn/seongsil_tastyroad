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
  const listRef = useRef(null); // 리스트 컨테이너 참조

  // --- [모바일 바텀 시트 로직] ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const peekHeight = 160; // 접혔을 때 높이
  const [sheetY, setSheetY] = useState(window.innerHeight - peekHeight);
  const touchStartRef = useRef({ y: 0, sheetY: 0 });
  const isSheetDraggingRef = useRef(false); // 시트 자체를 드래그 중인지 여부

  const CHURCH_ADDRESS = "서울 강북구 노해로 50";
  const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '분식', '카페'];

  // --- [효과 관리] ---

  // 1. 화면 크기 변화 감지
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSheetY(0); // PC 버전은 시트 위치 고정
      else setSheetY(window.innerHeight - peekHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. 모달 열릴 때 배경 스크롤 차단
  useEffect(() => {
    if (isAddModalOpen || isReviewModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isAddModalOpen, isReviewModalOpen]);

  // --- 📱 [핵심] 터치 이벤트 처리 (지도-시트 간섭 해결) ---

  const onTouchStart = (e) => {
    if (!isMobile) return;

    // 🌟 [해결 1] '-' 모양의 핸들 영역을 터치했는지 확인
    const isHandle = e.target.closest('.sheet-handle-area');

    touchStartRef.current.y = e.touches[0].clientY;
    touchStartRef.current.sheetY = sheetY;

    // 팀장님 요청 사항: 핸들을 잡았을 때만 시트를 움직임
    if (isHandle) {
      isSheetDraggingRef.current = true;
    } else {
      isSheetDraggingRef.current = false;
    }
  };

  const onTouchMove = (e) => {
    if (!isMobile) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartRef.current.y;
    const scrollTop = listRef.current ? listRef.current.scrollTop : 0;

    // 🌟 [해결 2] 시트 자체를 올리거나 내릴 때 (핸들을 잡았을 때만)
    if (isSheetDraggingRef.current) {
      let newY = touchStartRef.current.sheetY + deltaY;

      // 이동 범위 제한 (최상단 60px ~ 최하단 peekHeight)
      newY = Math.max(60, Math.min(newY, window.innerHeight - peekHeight));

      if (e.cancelable) e.preventDefault(); // 브라우저 기본 스크롤 차단
      setSheetY(newY);
    }
    // 🌟 [해결 3] 핸들이 아닌 리스트 내부를 스크롤할 때
    else {
      // 리스트가 맨 위(scrollTop 0)이고, 아래로 당길 때는 시트가 내려가게 허용 (내비 앱 일반 방식)
      if (scrollTop <= 0 && deltaY > 0) {
        let newY = touchStartRef.current.sheetY + deltaY;
        newY = Math.max(60, Math.min(newY, window.innerHeight - peekHeight));
        setSheetY(newY);
      }
      // 그 외엔 리스트 자체 스크롤이 작동하도록 둠 (이벤트 중단 없음)
    }
  };

  const onTouchEnd = () => {
    if (!isMobile) return;
    isSheetDraggingRef.current = false;

    // 자석 효과 (Snap): 45% 기준으로 펼치거나 접음
    const snapThreshold = window.innerHeight * 0.45;
    if (sheetY < snapThreshold) {
      setSheetY(60); // 활짝 펼침
    } else {
      setSheetY(window.innerHeight - peekHeight); // 최소화
      if (listRef.current) listRef.current.scrollTop = 0; // 접을 때 리스트 상단으로 이동
    }
  };

  const mobileSheetStyle = isMobile ? {
    transform: `translateY(${sheetY}px)`,
    transition: isSheetDraggingRef.current ? 'none' : 'transform 0.3s ease-out',
    height: `calc(100vh - 60px)`,
  } : {};

  // --- [기능 함수들] ---

  // 1. 내 위치로 이동
  const moveToMyLocation = () => {
    if (!navigator.geolocation) return alert("GPS를 지원하지 않는 브라우저입니다.");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myPos = new window.google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        mapInstance.current.panTo(myPos);
        mapInstance.current.setZoom(17);

        // 현재 위치 마커 표시
        if (myLocMarkerRef.current) myLocMarkerRef.current.setMap(null);
        myLocMarkerRef.current = new window.google.maps.Marker({
          position: myPos,
          map: mapInstance.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#3B82F6',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 7
          }
        });
      },
      () => alert("위치 권한을 허용해주세요."),
      { enableHighAccuracy: true }
    );
  };

  // 2. 서버에서 식당 데이터 로드
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
    } catch (e) {
      console.error("데이터 로드 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(); }, []);

  // 3. 주소 -> 좌표 변환 (Geocoding)
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

  // 4. 지도 및 마커 초기화
  useEffect(() => {
    if (loading || !window.google || !mapRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        disableDefaultUI: true,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
      });

      getCoordinates(CHURCH_ADDRESS, (churchLocation) => {
        mapInstance.current.setCenter(churchLocation);

        // 성실교회 마커
        new window.google.maps.Marker({
          map: mapInstance.current, position: churchLocation, title: "수유 성실교회",
          icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", labelOrigin: new window.google.maps.Point(14, -15) },
          label: { text: "수유 성실교회", className: "church-marker-label", fontWeight: "bold" }
        });

        // 식당 마커들
        restaurants.forEach(res => {
          getCoordinates(res.address, (location) => {
            const marker = new window.google.maps.Marker({
              map: mapInstance.current, position: location, title: res.name,
              icon: { url: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png", labelOrigin: new window.google.maps.Point(14, -15) },
              label: { text: res.name, className: "restaurant-marker-label", fontWeight: "bold" }
            });
            marker.addListener("click", () => setSelectedRes(res));
            markersRef.current.push(marker);

            // 🌟 교회에서의 거리 계산
            if (window.google.maps.geometry) {
              const dist = window.google.maps.geometry.spherical.computeDistanceBetween(churchLocation, location);
              setDistances(prev => ({ ...prev, [res.id]: dist }));
            }
          });
        });
      });
    }
  }, [loading, restaurants]);

  // 5. 식당 선택 시 지도 이동
  useEffect(() => {
    if (!mapInstance.current) return;
    if (selectedRes) {
      getCoordinates(selectedRes.address, (location) => {
        mapInstance.current.panTo(location); mapInstance.current.setZoom(17);
      });
    } else {
      getCoordinates(CHURCH_ADDRESS, (location) => {
        mapInstance.current.panTo(location); mapInstance.current.setZoom(16);
      });
    }
  }, [selectedRes]);

  // 6. 필터링 및 검색
  const filteredList = restaurants.filter(r => (r.name.includes(searchQuery) || r.address.includes(searchQuery)) && (activeCategory === '전체' || r.category === activeCategory));

  // 7. 리뷰 제출
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const reviewData = {
      restaurant: selectedRes.name, address: selectedRes.address,
      category: selectedRes.category, rating: newReview.rating,
      comment: newReview.comment, author: newReview.author,
      timestamp: new Date().toISOString()
    };

    // UI 즉시 반영
    const updatedRes = { ...selectedRes };
    updatedRes.reviews = [reviewData, ...updatedRes.reviews];
    updatedRes.avgRating = (updatedRes.reviews.reduce((sum, r) => sum + r.rating, 0) / updatedRes.reviews.length).toFixed(1);
    setSelectedRes(updatedRes);
    setRestaurants(prev => prev.map(r => r.id === updatedRes.id ? updatedRes : r));

    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(reviewData) });
      alert("리뷰가 성공적으로 등록되었습니다!");
    } finally {
      setIsSubmitting(false); setIsReviewModalOpen(false);
      setNewReview({ rating: 5, comment: '', author: '' });
    }
  };

  // 8. 카카오 장소 검색 API
  const searchPlaces = () => {
    if (!searchKeyword.trim()) return;
    setIsSearching(true);
    window.kakao.maps.load(() => {
        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(searchKeyword, (data, status) => {
          if (status === window.kakao.maps.services.Status.OK) {
            setSearchResults(data);
          } else {
            alert("검색 결과가 없습니다.");
            setSearchResults([]);
          }
          setIsSearching(false);
        });
    });
  };

  const handleSelectPlace = (place) => {
    const address = place.road_address_name || place.address_name;
    setNewRes({ ...newRes, name: place.place_name, address: address });
    setSearchResults([]); setSearchKeyword('');
  };

  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRes.name || !newRes.address) return alert("식당을 먼저 선택해주세요.");
    setIsSubmitting(true);
    const initialReview = { restaurant: newRes.name, address: newRes.address, category: newRes.category, rating: newReview.rating, comment: newReview.comment, author: newReview.author, timestamp: new Date().toISOString() };
    const newRestaurantData = { id: newRes.name, name: newRes.name, address: newRes.address, category: newRes.category, avgRating: newReview.rating.toFixed(1), reviews: [initialReview] };

    setRestaurants([newRestaurantData, ...restaurants]);
    setSelectedRes(newRestaurantData);

    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(initialReview) });
      alert("새로운 맛집이 등록되었습니다!");
    } finally {
      setIsSubmitting(false); setIsAddModalOpen(false);
      setNewRes({ name: '', category: '한식', address: '' });
      setNewReview({ rating: 5, comment: '', author: '' });
      setIsManualAddress(false);
    }
  };

  // --- [UI 렌더링 시작] ---

  if (loading) return <div className="h-screen flex items-center justify-center text-orange-500 font-bold"><Loader2 className="animate-spin mr-2"/> 맛집 지도를 불러오는 중...</div>;

  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 flex flex-col overflow-hidden">

      {/* 🌟 상단 헤더 */}
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

        {/* --- 🗺️ 왼쪽: 지도 구역 --- */}
        <section className="absolute inset-0 z-0 lg:static lg:w-1/2 lg:h-full bg-slate-200">
          <div ref={mapRef} className="w-full h-full" />

          {/* 🌟 [요청기능] 내 위치 버튼 */}
          <button
            onClick={moveToMyLocation}
            className="absolute right-4 bottom-[180px] lg:bottom-6 z-10 bg-white p-3.5 rounded-full shadow-2xl border border-slate-100 text-slate-700 active:bg-slate-100 transition-all"
          >
            <Navigation size={22} className="fill-slate-700" />
          </button>

          {/* 네이버 지도 길찾기 버튼 (지도의 선택 마커를 따라다님) */}
          {selectedRes && (
            <div className="absolute transition-all duration-300 left-1/2 -translate-x-1/2 z-10"
                 style={{ bottom: isMobile ? `calc(100vh - ${sheetY}px - 60px)` : '1.5rem' }}>
              <a href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedRes.name + " 수유동")}`} target="_blank" rel="noreferrer"
                 className="bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs lg:text-base hover:bg-green-700 transition scale-90 lg:scale-100">
                <MapIcon size={18} /> 네이버 길찾기
              </a>
            </div>
          )}
        </section>

        {/* --- 📝 오른쪽/하단: 바텀 시트 (리스트/상세) --- */}
        <section
          className="fixed bottom-0 left-0 w-full z-20 bg-white rounded-t-[32px] lg:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col lg:static lg:w-1/2 lg:h-full lg:shadow-none lg:border-l lg:border-slate-200 overflow-hidden"
          style={mobileSheetStyle}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* 🌟 [중요] 드래그 핸들: 이 부분을 스크롤할 때만 시트가 움직임 */}
          <div className="sheet-handle-area lg:hidden w-full p-5 flex justify-center items-center cursor-ns-resize shrink-0">
            <div className="w-14 h-1.5 bg-slate-200 rounded-full"></div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 리스트 헤더: 검색 및 카테고리 */}
            <div className="p-4 border-b border-slate-100 shrink-0 bg-white">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                <input type="text" placeholder="맛집 이름이나 주소 검색..." className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl outline-none focus:ring-2 focus:ring-orange-400 text-base lg:text-sm transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-2 mt-3 overflow-x-auto custom-scrollbar pb-1">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm border ${activeCategory === cat ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              {/* --- 🌟 [요청사항] 리스트 영역 (내부 스크롤만 됨) --- */}
              <div
                ref={listRef}
                className={`w-full lg:w-2/5 shrink-0 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-slate-50/50 transition-all ${selectedRes && isMobile ? 'invisible opacity-0' : 'visible opacity-100'}`}
                style={{ overscrollBehavior: 'contain' }}
              >
                {activeCategory === '전체' && (
                  <button onClick={() => setSelectedRes(null)} className="w-full text-left p-4 rounded-2xl border-2 bg-blue-50 border-blue-200 mb-2">
                    <h3 className="font-bold text-blue-900 text-sm">수유 성실교회</h3><p className="text-[11px] text-blue-500 mt-1">우리들의 베이스캠프 ⛪</p>
                  </button>
                )}
                {filteredList.map(res => (
                  <div key={res.id} onClick={() => setSelectedRes(res)} className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400' : 'bg-white border-transparent shadow-sm hover:shadow-md'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="font-bold text-slate-900 text-sm truncate">{res.name}</h3>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{res.category}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                      <Star size={14} className="fill-orange-400 text-orange-400" /> {res.avgRating}

                      {/* 🌟 [요청사항] 교회 기준 거리 명시 */}
                      {distances[res.id] && (
                        <span className="ml-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                          ⛪ 교회에서 {distances[res.id] < 1000 ? `${Math.round(distances[res.id])}m` : `${(distances[res.id] / 1000).toFixed(1)}km`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* --- 🌟 상세 화면 영역 (내부 스크롤 고정) --- */}
              <div className={`w-full lg:w-3/5 shrink-0 overflow-y-auto custom-scrollbar p-6 bg-white transition-all duration-300 ${selectedRes ? 'absolute inset-0 lg:static translate-x-0' : 'absolute inset-0 lg:static translate-x-full lg:translate-x-0'}`} style={{ overscrollBehavior: 'contain' }}>
                {selectedRes && (
                  <>
                    <div className="flex justify-between items-start mb-6 pb-5 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-bold text-orange-600 bg-orange-100 px-2.5 py-1 rounded-md">{selectedRes.category}</span>
                        <h2 className="text-2xl font-black text-slate-900 mt-2.5">{selectedRes.name}</h2>
                        <div className="flex flex-col gap-1.5 mt-2.5">
                           <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={13}/>{selectedRes.address}</p>

                           {/* 🌟 상세 화면 거리 명시 */}
                           {distances[selectedRes.id] && (
                             <p className="text-xs font-bold text-blue-600 flex items-center gap-1 bg-blue-50 w-fit px-2 py-1 rounded-lg">
                               <Church size={13} /> 성실교회에서 {Math.round(distances[selectedRes.id])}m 거리에 위치
                             </p>
                           )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedRes(null)} className="lg:hidden p-2 text-slate-400 active:scale-90 transition-all"><X size={24}/></button>
                        <button onClick={() => setIsReviewModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all">리뷰 남기기</button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {selectedRes.reviews.map((r, i) => (
                        <div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-sm">
                          <div className="flex justify-between items-center mb-2.5">
                            <span className="font-bold text-sm text-slate-800">{r.author}</span>
                            <div className="flex gap-0.5">{[1,2,3,4,5].map(num => <Star key={num} size={12} className={num <= r.rating ? "fill-orange-400 text-orange-400" : "text-slate-200"} />)}</div>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed bg-white/50 p-3 rounded-xl">{r.comment}</p>
                          <p className="text-[10px] text-slate-400 mt-3 font-medium">{new Date(r.timestamp).toLocaleDateString()}</p>
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

      {/* --- 🌟 모달: 새 맛집 등록 --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-[32px] w-full max-w-md p-7 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-2 border-b">
              <h2 className="text-xl font-black text-slate-900">새 맛집 제보하기</h2>
              <X className="cursor-pointer text-slate-400 hover:text-slate-900 transition" onClick={() => setIsAddModalOpen(false)} />
            </div>

            <div className="overflow-y-auto flex-1 space-y-5 py-3 custom-scrollbar">
              <div className="flex justify-end">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer hover:text-orange-500 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded text-orange-500" checked={isManualAddress} onChange={(e) => setIsManualAddress(e.target.checked)} />
                  직접 주소 입력하기
                </label>
              </div>

              {!isManualAddress ? (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <label className="text-xs font-bold text-slate-400">식당 이름으로 검색</label>
                  <div className="flex gap-2">
                    <input type="text" className="flex-1 p-3.5 bg-white rounded-xl border-slate-200 outline-none text-base lg:text-sm shadow-sm focus:border-orange-400" placeholder="예: 수유리 우동집" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchPlaces())} />
                    <button type="button" onClick={searchPlaces} className="px-5 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs active:scale-95 transition-all">
                      {isSearching ? <Loader2 className="animate-spin" size={18}/> : '검색'}
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <ul className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl divide-y shadow-inner custom-scrollbar">
                      {searchResults.map(place => (
                        <li key={place.id} onClick={() => handleSelectPlace(place)} className="p-3.5 hover:bg-orange-50 cursor-pointer text-sm transition-colors">
                          <div className="font-bold text-slate-900">{place.place_name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{place.address_name}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {newRes.name && (
                    <div className="p-3.5 bg-orange-100 rounded-xl border border-orange-200">
                       <p className="text-[11px] font-bold text-orange-600 mb-1">선택된 식당</p>
                       <p className="font-bold text-slate-900 text-sm">{newRes.name}</p>
                       <p className="text-xs text-slate-600 mt-0.5">{newRes.address}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 p-5 bg-orange-50 rounded-2xl border border-orange-100">
                  <input required className="w-full p-3.5 rounded-xl border border-orange-200 outline-none text-base lg:text-sm focus:border-orange-400" placeholder="식당 이름을 입력하세요" value={newRes.name} onChange={e => setNewRes({...newRes, name: e.target.value})} />
                  <input required className="w-full p-3.5 rounded-xl border border-orange-200 outline-none text-base lg:text-sm focus:border-orange-400" placeholder="도로명 주소를 입력하세요" value={newRes.address} onChange={e => setNewRes({...newRes, address: e.target.value})} />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 ml-1">카테고리 선택</label>
                  <select className="w-full mt-1.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 outline-none text-base lg:text-sm focus:border-orange-400" value={newRes.category} onChange={e => setNewRes({...newRes, category: e.target.value})}>
                    {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="pt-5 border-t border-slate-100 space-y-4">
                  <p className="text-sm font-bold text-slate-800 text-center">첫 리뷰도 함께 남겨주세요!</p>
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={32} className={`cursor-pointer transition-all hover:scale-110 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}
                  </div>
                  <input required className="w-full p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-base lg:text-sm focus:border-orange-400" placeholder="이 맛집의 매력은 무엇인가요?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} />
                  <input required className="w-full p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-base lg:text-sm focus:border-orange-400" placeholder="작성자 닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full py-4.5 bg-orange-500 text-white rounded-2xl font-bold shadow-lg active:bg-orange-600 transition-all flex justify-center items-center">
               {isSubmitting ? <Loader2 className="animate-spin" size={22}/> : "맛집 등록하기 🚀"}
            </button>
          </form>
        </div>
      )}

      {/* --- 🌟 모달: 리뷰 쓰기 --- */}
      {isReviewModalOpen && selectedRes && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form onSubmit={handleReviewSubmit} className="bg-white rounded-[32px] w-full max-w-sm p-7 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-black text-slate-900">리뷰 남기기</h2>
                <X className="cursor-pointer text-slate-400" onClick={() => setIsReviewModalOpen(false)} />
            </div>
            <div className="flex-1 overflow-y-auto space-y-5 py-2 custom-scrollbar">
              <p className="text-center font-bold text-slate-600">"{selectedRes.name}" <br/>어떠셨나요?</p>
              <div className="flex gap-2.5 justify-center py-2">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} size={38} className={`cursor-pointer transition-all hover:scale-110 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />)}
              </div>
              <textarea required className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 h-36 text-base lg:text-sm outline-none focus:border-orange-400" placeholder="솔직한 맛 평가를 들려주세요!" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})}></textarea>
              <input required className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-base lg:text-sm outline-none focus:border-orange-400" placeholder="닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg active:bg-orange-600 transition-all">
               {isSubmitting ? <Loader2 className="animate-spin m-auto" size={20}/> : "등록하기"}
            </button>
          </form>
        </div>
      )}

      {/* --- 🌟 CSS Styles --- */}
      <style>{`
        /* 스크롤바 커스텀 */
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

        /* 지도 마커 라벨 */
        .church-marker-label { background-color: white; color: #1e3a8a; font-size: 13px; padding: 5px 12px; border-radius: 10px; border: 2.5px solid #3b82f6; box-shadow: 0 4px 10px rgba(0,0,0,0.15); margin-top: -32px; white-space: nowrap; pointer-events: none; }
        .restaurant-marker-label { background-color: white; color: #ea580c; font-size: 13px; padding: 5px 12px; border-radius: 10px; border: 2.5px solid #f97316; box-shadow: 0 4px 10px rgba(0,0,0,0.15); margin-top: -32px; white-space: nowrap; pointer-events: none; }

        /* 모바일 스크롤바 숨기기 */
        @media (max-width: 1023px) {
          .custom-scrollbar::-webkit-scrollbar { display: none; }
        }

        /* 입력창 줌 방지 */
        input, select, textarea { font-size: 16px !important; }
      `}</style>
    </div>
  );
};

export default App;