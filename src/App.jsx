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
  MapPinned
} from 'lucide-react';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdChOl5CumYzkX-rjai2BpD91BQBH193NrKLL2RRIvxGKJFRx0_Si0zIFM_BClJA5M/exec";
const KAKAO_REST_API_KEY = "4b4732b74bb79d6abadc2a621cca8b7b"; // 이제 불필요하지만 에러방지용으로 유지

const App = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRes, setSelectedRes] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // 맛집 등록 상태
  const [newRes, setNewRes] = useState({ name: '', category: '한식', address: '' });
  const [newReview, setNewReview] = useState({ rating: 5, comment: '', author: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualAddress, setIsManualAddress] = useState(false);

  // 식당 검색 관련 상태
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [distances, setDistances] = useState({});

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const geocodeCache = useRef({});

  const CHURCH_ADDRESS = "서울 강북구 노해로 50";
  const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '분식', '카페'];

  // 🌟 모달 열릴 때 PC버전 리스트 스크롤 방지용
  useEffect(() => {
    if (isAddModalOpen || isReviewModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isAddModalOpen, isReviewModalOpen]);

  // 🌟 [모바일 UX 고도화] 바텀 시트 (Bottom Sheet) 터치 이벤트 로직
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const peekHeight = 160; // 최소화되었을 때 노출될 높이 (px)
  const [sheetY, setSheetY] = useState(window.innerHeight - peekHeight); // 초기 위치: 최소화된 상태
  const touchStartRef = useRef({ y: 0, sheetY: 0 });
  const isSheetDraggingRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setSheetY(0); // PC 화면에서는 시트 위치 리셋
      } else {
        // 모달 열릴 때를 제외하고 최소화 높이로 리셋
        if(!isAddModalOpen && !isReviewModalOpen) {
            setSheetY(window.innerHeight - peekHeight);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // 초기 실행
    return () => window.removeEventListener('resize', handleResize);
  }, [isAddModalOpen, isReviewModalOpen]);

  const onTouchStart = (e) => {
    if (!isMobile) return;
    touchStartRef.current.y = e.touches[0].clientY;
    touchStartRef.current.sheetY = sheetY;
    isSheetDraggingRef.current = true;
    // 시트 드래그 중 지도 스크롤 방지
    document.body.style.overflow = 'hidden';
  };

  const onTouchMove = (e) => {
    if (!isMobile || !isSheetDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartRef.current.y;
    let newY = touchStartRef.current.sheetY + deltaY;

    // 드래그 제한 범위 설정 (최상단 gap ~ 최하단 peek)
    const minY = 60; // 최상단에 약간의 갭을 둡니다.
    const maxY = window.innerHeight - peekHeight;
    newY = Math.max(minY, Math.min(newY, maxY));

    setSheetY(newY);
  };

  const onTouchEnd = () => {
    if (!isMobile || !isSheetDraggingRef.current) return;
    isSheetDraggingRef.current = false;
    document.body.style.overflow = ''; // 지도 스크롤 해제

    // 스냅 (Snap) 로직: 특정 위치 이상이면 펼치고, 아니면 접습니다.
    const snapThreshold = window.innerHeight * 0.45; // 화면 높이의 45%를 기준으로 스냅
    if (sheetY < snapThreshold) {
      setSheetY(60); // 펼치기
    } else {
      setSheetY(window.innerHeight - peekHeight); // 최소화
    }
  };

  // 모바일 전용 시트 스타일 계산
  const mobileSheetStyle = isMobile ? {
    transform: `translateY(${sheetY}px)`,
    transition: isSheetDraggingRef.current ? 'none' : 'transform 0.3s ease-out', // 드래그 중엔 애니메이션 Off, 스냅 시 On
    height: `calc(100vh - 60px)`, // 화면 전체 높이에서 상단 gap 제외
  } : {};

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
    } catch (e) {
      console.error("데이터 로딩 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  // 주소를 좌표로 변환
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

  // 구글 지도 렌더링 및 마커 설정
  useEffect(() => {
    if (loading || !window.google || !mapRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        disableDefaultUI: true, // 구글 기본 UI 숨기기
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
      });

      getCoordinates(CHURCH_ADDRESS, (churchLocation) => {
        mapInstance.current.setCenter(churchLocation);
        new window.google.maps.Marker({
          map: mapInstance.current,
          position: churchLocation,
          title: "수유 성실교회",
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            labelOrigin: new window.google.maps.Point(14, -15)
          },
          label: {
            text: "수유 성실교회",
            className: "church-marker-label",
            fontWeight: "bold"
          }
        });

        restaurants.forEach(res => {
          getCoordinates(res.address, (location) => {
            const marker = new window.google.maps.Marker({
              map: mapInstance.current,
              position: location,
              title: res.name,
              icon: {
                url: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
                labelOrigin: new window.google.maps.Point(14, -15)
              },
              label: {
                text: res.name,
                className: "restaurant-marker-label",
                fontWeight: "bold"
              }
            });
            marker.addListener("click", () => setSelectedRes(res));
            markersRef.current.push(marker);

            if (window.google.maps.geometry) {
              const dist = window.google.maps.geometry.spherical.computeDistanceBetween(churchLocation, location);
              setDistances(prev => ({ ...prev, [res.id]: dist }));
            }
          });
        });
      });
    }
  }, [loading, restaurants]);

  // 지도 시점 이동
  useEffect(() => {
    if (!mapInstance.current) return;
    if (selectedRes) {
      getCoordinates(selectedRes.address, (location) => {
        mapInstance.current.panTo(location);
        mapInstance.current.setZoom(17);
      });
    } else {
      getCoordinates(CHURCH_ADDRESS, (location) => {
        mapInstance.current.panTo(location);
        mapInstance.current.setZoom(16);
      });
    }
  }, [selectedRes]);

  // 검색 및 카테고리 필터링
  const filteredList = restaurants.filter(r => {
    const matchesSearch = r.name.includes(searchQuery) || r.address.includes(searchQuery);
    const matchesCategory = activeCategory === '전체' || r.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

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

  const searchPlaces = async () => {
    if (!searchKeyword.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
        alert("카카오 지도 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        setIsSearching(false);
        return;
    }

    // 카카오 SDK의 장소 검색 서비스 객체 생성
    const ps = new window.kakao.maps.services.Places();

    // 키워드로 장소 검색
    ps.keywordSearch(searchKeyword, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        setSearchResults(data);
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        alert("검색 결과가 없습니다.");
        setSearchResults([]);
      } else {
        alert("검색 중 오류가 발생했습니다.");
        setSearchResults([]);
      }
      setIsSearching(false);
    });
  };

  const handleSelectPlace = (place) => {
    const address = place.road_address_name || place.address_name;
    setNewRes({ ...newRes, name: place.place_name, address: address });
    setSearchResults([]);
    setSearchKeyword('');
  };

  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    if (!newRes.name || !newRes.address) {
      alert("식당을 선택하거나 주소를 입력해주세요.");
      return;
    }
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
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(initialReview) });
      alert("맛집이 등록되었습니다!");
    } finally {
      setIsSubmitting(false);
      setIsAddModalOpen(false);
      setNewRes({ name: '', category: '한식', address: '' });
      setNewReview({ rating: 5, comment: '', author: '' });
      setIsManualAddress(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-orange-500 font-bold"><Loader2 className="animate-spin mr-2"/> 맛집 지도를 불러오는 중...</div>;

  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 flex flex-col overflow-hidden">
      {/* 🌟 [반응형 레이아웃 수정] 헤더를 모바일에서는 플로팅으로, PC에서는 고정으로 설정 */}
      <header className="fixed top-0 left-0 w-full z-30 lg:static lg:w-full bg-white/95 backdrop-blur-sm lg:backdrop-blur-none border-b border-slate-200 px-6 py-4 lg:py-4 flex justify-between items-center shrink-0 shadow-md lg:shadow-none">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-xl shadow-md"><Utensils className="text-white" size={20} /></div>
          <h1 className="text-lg lg:text-xl font-black tracking-tight">성실 맛집 <span className="text-orange-500">Map</span></h1>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs lg:text-sm font-bold flex items-center gap-1.5 hover:bg-slate-800 transition shadow-md whitespace-nowrap">
          <Plus size={16} /> 새 맛집 제보
        </button>
      </header>

      {/* 🌟 [반응형 메인 레이아웃] 모바일에서는 지도 전체화면, PC에서는 좌우 분할 */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative pt-[73px] lg:pt-0">

        {/* 🗺️ 왼쪽/전체: 지도 구역 */}
        {/* 🌟 모달 열릴 때 PC버전 리스트 스크롤 방지용 */}
        <section className="absolute inset-0 z-0 lg:static lg:z-auto lg:w-1/2 lg:h-full bg-slate-200">
          <div ref={mapRef} className="w-full h-full" />

          {/* 🌟 [네이버 지도 스타일] 네이버 지도 바로가기 버튼을 지도 위에 플로팅 */}
          {selectedRes && (
            <div className="absolute transition-all duration-300 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap"
                 style={{
                   bottom: isMobile
                     ? `calc(100vh - ${sheetY}px - 73px + 1rem)` // 헤더와 시트 높이를 고려한 위치
                     : '1.5rem' // PC 버전 하단 고정
                 }}>
              <a href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedRes.name + " 수유동")}`} target="_blank" rel="noreferrer"
                 className="bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs lg:text-base hover:bg-green-700 transition hover:scale-105">
                <MapIcon size={18} /> 네이버 지도에서 길찾기
              </a>
            </div>
          )}
        </section>

        {/* 📝 오른쪽/하단 시트: 리스트/상세 구역 */}
        {/* 🌟 [모바일 UX 고도화] 모바일에서는 바텀 시트 (Bottom Sheet) 형태로 구현 */}
        <section
          className="fixed bottom-0 left-0 w-full z-20 bg-white rounded-t-3xl lg:rounded-none shadow-2xl flex flex-col transition-transform duration-300 ease-out
                     lg:static lg:z-auto lg:w-1/2 lg:h-full lg:shadow-none lg:border-l lg:border-slate-200 overflow-hidden"
          style={mobileSheetStyle}
        >
          {/* 🌟 [네이버 지도 스타일] 바텀 시트 드래그용 핸들 (모바일만 노출) */}
          <div
            className="lg:hidden w-full p-4 flex justify-center items-center cursor-ns-resize shrink-0"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="w-16 h-1.5 bg-slate-200 rounded-full"></div>
          </div>

          {/* --- 시트 내부 콘텐츠 --- */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 검색창 및 카테고리 (시트 상단 고정) */}
            <div className="p-4 border-b border-slate-100 shrink-0 bg-slate-50">
              {/* 🌟 [모바일 줌 방지] text-base lg:text-sm 클래스 적용 */}
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input type="text" placeholder="맛집 이름이나 주소 검색..."
                       className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 shadow-sm text-base lg:text-sm" // 🌟 Zoom Fix
                       value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-2 mt-3 overflow-x-auto custom-scrollbar pb-1">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors shadow-sm border ${activeCategory === cat ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 리스트와 상세화면의 이중 구조 */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              {/* 식당 목록 (PC 왼쪽 고정, 상세화면 열리면 PC에서만 숨김) */}
              <div className={`transition-all duration-300 ease-out
                               w-full lg:w-2/5 shrink-0 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-slate-50/50
                               ${selectedRes && isMobile ? 'absolute inset-0 -translate-x-full' : 'absolute inset-0 lg:static'}`}>
                {activeCategory === '전체' && (
                  <button onClick={() => setSelectedRes(null)} className={`w-full text-left p-4 rounded-xl border-2 transition ${!selectedRes ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                    <h3 className="font-bold text-blue-900 truncate text-sm">수유 성실교회</h3><p className="text-[11px] text-blue-500 mt-1">우리들의 베이스캠프</p>
                  </button>
                )}
                {filteredList.map(res => (
                  <div key={res.id} onClick={() => setSelectedRes(res)} className={`p-4 rounded-xl cursor-pointer border-2 transition ${selectedRes?.id === res.id ? 'bg-orange-50 border-orange-400 shadow-sm' : 'bg-white border-transparent hover:bg-white shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-slate-900 truncate pr-2 text-sm">{res.name}</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium whitespace-nowrap">{res.category}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs font-bold text-slate-600 flex-wrap">
                      <Star size={14} className="fill-orange-400 text-orange-400" /> {res.avgRating} <span className="text-slate-400 text-[11px] font-normal">({res.reviews.length})</span>
                      {distances[res.id] && (
                        <span className="ml-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 whitespace-nowrap">
                          📍 {distances[res.id] < 1000 ? `${Math.round(distances[res.id])}m` : `${(distances[res.id] / 1000).toFixed(1)}km`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 상세화면 (모바일에서는 리스트를 덮고, PC에서는 오른쪽에 노출) */}
              <div className={`transition-all duration-300 ease-out
                               w-full lg:w-3/5 shrink-0 overflow-y-auto custom-scrollbar p-6 bg-slate-50
                               ${selectedRes ? 'absolute inset-0 lg:static' : 'absolute inset-0 translate-x-full lg:static lg:translate-x-0'}`}>
                {selectedRes ? (
                  <>
                    <div className="flex justify-between items-start mb-6 pb-2 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                           <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-md">{selectedRes.category}</span>
                           <h2 className="text-2xl font-black text-slate-900 leading-tight">{selectedRes.name}</h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1"><MapPin size={12}/>{selectedRes.address}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                         {/* 모바일에서만 노출되는 목록 돌아가기 버튼 */}
                         <button onClick={() => setSelectedRes(null)} className="lg:hidden text-slate-500 p-2 hover:text-slate-900 hover:bg-slate-100 rounded-full transition"><X size={20}/></button>
                         <button onClick={() => setIsReviewModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-md hover:scale-105 transition flex items-center gap-1.5"><MessageSquare size={16}/> 리뷰 쓰기</button>
                      </div>
                    </div>
                    {/* 🌟 [상세 UX 개선] 상세화면의 overflow-y-auto를 사용하여 리뷰가 밀리지 않도록 고정된 헤더와 분리 */}
                    <div className="space-y-5">
                      {selectedRes.reviews.map((r, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-sm text-slate-800">{r.author}</span>
                            <div className="flex">{[1,2,3,4,5].map(num => <Star key={num} size={14} className={num <= r.rating ? "fill-orange-400 text-orange-400" : "text-slate-200"} />)}</div>
                          </div>
                          <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl leading-relaxed">{r.comment}</p>
                          <div className="text-right mt-2.5"><span className="text-[10px] text-slate-400 font-medium">{new Date(r.timestamp).toLocaleDateString()}</span></div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  // PC버전에서 상세화면이 없을 때의 안내 (모바일은 리스트가 꽉참)
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-3 p-10 hidden lg:flex">
                    <div className="bg-blue-100 p-4 rounded-full shadow-inner"><Church size={32} className="text-blue-500" /></div>
                    <p className="text-center leading-relaxed"><strong>수유 성실교회</strong>를 중심으로<br/>청년들의 맛집 지도가 펼쳐집니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 모달: 새 맛집 등록 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm text-sm">
          <form onSubmit={handleAddRestaurant} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
              <h2 className="text-xl font-black text-slate-900">새 맛집 제보하기</h2>
              <X className="cursor-pointer text-slate-400 hover:text-slate-900 transition" onClick={() => { setIsAddModalOpen(false); setSearchResults([]); setSearchKeyword(''); }} />
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-4 py-2">
              <div className="flex justify-end">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <span className="text-xs font-medium text-slate-500 group-hover:text-orange-500 transition">직접 입력 모드</span>
                  <input type="checkbox" className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500 cursor-pointer" checked={isManualAddress} onChange={(e) => { setIsManualAddress(e.target.checked); setNewRes({name:'', category:'한식', address:''}); setSearchResults([]); setSearchKeyword(''); }} />
                </label>
              </div>

              {!isManualAddress ? (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <label className="text-xs font-bold text-slate-500">식당 이름으로 검색</label>
                  <div className="flex gap-2">
                    {/* 🌟 [모바일 줌 방지] text-base lg:text-sm 클래스 적용 */}
                    <input type="text" className="flex-1 p-3 bg-white rounded-xl border border-slate-200 outline-none focus:border-orange-400 shadow-inner text-base lg:text-sm" placeholder="예: 수유리 우동집" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); searchPlaces(); } }} />
                    <button type="button" onClick={searchPlaces} disabled={isSearching} className="px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs lg:text-sm whitespace-nowrap hover:bg-slate-700 transition">
                      {isSearching ? <Loader2 className="animate-spin" size={16}/> : '검색'}
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <ul className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl custom-scrollbar divide-y divide-slate-100 shadow-inner">
                      {searchResults.map(place => (
                        <li key={place.id} onClick={() => handleSelectPlace(place)} className="p-3 hover:bg-orange-50 cursor-pointer transition">
                          <div className="font-bold text-sm text-slate-900">{place.place_name}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPinned size={10}/>{place.road_address_name || place.address_name}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {newRes.name && (
                    <div className="mt-3 p-3 bg-orange-100 border border-orange-200 rounded-xl">
                      <p className="font-bold text-slate-900">{newRes.name}</p>
                      <p className="text-xs text-slate-600 mt-1">{newRes.address}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                  {/* 🌟 [모바일 줌 방지] text-base lg:text-sm 클래스 적용 */}
                  <input required className="w-full p-3 bg-white rounded-xl border border-orange-200 outline-none shadow-inner text-base lg:text-sm" placeholder="식당 이름 (수동)" value={newRes.name} onChange={e => setNewRes({...newRes, name: e.target.value})} />
                  <input required className="w-full p-3 bg-white rounded-xl border border-orange-200 outline-none shadow-inner text-base lg:text-sm" placeholder="도로명 주소 (수동)" value={newRes.address} onChange={e => setNewRes({...newRes, address: e.target.value})} />
                </div>
              )}

              <div className="space-y-3">
                {/* 🌟 [모바일 줌 방지] text-base lg:text-sm 클래스 적용 */}
                <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 text-base lg:text-sm" value={newRes.category} onChange={e => setNewRes({...newRes, category: e.target.value})}>
                  {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c}>{c}</option>)}
                </select>
                <div className="border-t border-slate-100 pt-4 mt-2">
                  <div className="flex gap-1.5 mb-2 justify-center">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={28} className={`cursor-pointer transition hover:scale-110 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />
                    ))}
                  </div>
                  {/* 🌟 [모바일 줌 방지] text-base lg:text-sm 클래스 적용 */}
                  <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 mb-2 outline-none focus:border-orange-400 text-base lg:text-sm" placeholder="첫 한 줄 평 (가성비 등)" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} />
                  <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 text-base lg:text-sm" placeholder="작성자 닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold shrink-0 shadow-lg hover:bg-orange-600 transition">
               {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : "지도에 추가하기 🚀"}
            </button>
          </form>
        </div>
      )}

      {/* 모달: 리뷰 쓰기 */}
      {isReviewModalOpen && selectedRes && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <form onSubmit={handleReviewSubmit} className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0 mb-2">
                <h2 className="text-xl font-black text-slate-900truncate">"{selectedRes.name}" 리뷰</h2>
                <X className="cursor-pointer text-slate-400 hover:text-slate-900 transition" onClick={() => setIsReviewModalOpen(false)} />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4 py-2">
                <div className="flex gap-2 justify-center py-2">
                {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={36} className={`cursor-pointer transition hover:scale-110 ${i <= newReview.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-200'}`} onClick={() => setNewReview({...newReview, rating: i})} />
                ))}
                </div>
                {/* 🌟 [모바일 줌 방지] text-base lg:text-sm 클래스 적용 */}
                <textarea required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 h-32 text-base lg:text-sm" placeholder="맛, 분위기는 어떠셨나요?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})}></textarea>
                <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-orange-400 text-base lg:text-sm" placeholder="작성자 닉네임" value={newReview.author} onChange={e => setNewReview({...newReview, author: e.target.value})} />
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setIsReviewModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition">취소</button>
              <button type="submit" disabled={isSubmitting} className="flex-[2] py-3 bg-orange-500 text-white rounded-xl font-bold shadow-md hover:bg-orange-600 transition flex justify-center items-center">
                {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : "등록하기"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .church-marker-label { background-color: white; color: #1e3a8a; font-size: 13px; padding: 4px 10px; border-radius: 8px; border: 2px solid #3b82f6; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: -30px; white-space: nowrap; pointer-events: none; }
        .restaurant-marker-label { background-color: white; color: #ea580c; font-size: 13px; padding: 4px 10px; border-radius: 8px; border: 2px solid #f97316; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: -30px; white-space: nowrap; pointer-events: none; }
        /* 🌟 모바일에서 스크롤바 감추기 */
        @media (max-width: 1023px) {
            .custom-scrollbar::-webkit-scrollbar { display: none; }
        }
      `}</style>
    </div>
  );
};

export default App;