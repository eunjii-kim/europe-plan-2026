/**
 * 2026 유럽여행(스위스·이탈리아) 일정 데이터.
 * "2026 유럽여행.numbers" 파일의 "일정표" 탭 원본을 그대로 옮긴 것으로,
 * 각 timeBlock의 costItems.amount는 원래 통화 기준 "총 그룹 비용"이며
 * headcount로 나눈 값이 1인당 비용이다(원본 스프레드시트의 "비용(KRW)" 열과 동일한 방식).
 * KRW 환산은 여기서 하지 않고 budgetCalc.js에서 현재 환율로 계산한다.
 * @type {Array<{
 *   id: string,
 *   date: string,
 *   dateLabel: string,
 *   region: string,
 *   timeBlocks: Array<{
 *     time: string,
 *     title: string,
 *     note: string,
 *     locationTag?: string,
 *     costItems?: Array<{ category: string, currency: string, amount: number, headcount: number }>
 *   }>
 * }>}
 */
export const itineraryData = [
  {
    "id": "d2026-09-26",
    "date": "2026-09-26",
    "dateLabel": "9/26(토)",
    "region": "인터라켄",
    "timeBlocks": [
      {
        "time": "07:00",
        "title": "인천공항 도착(T2)",
        "note": "-",
        "locationTag": "인터라켄",
        "costItems": [
          {
            "category": "비행기",
            "currency": "KRW",
            "amount": 1138500.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "11:00",
        "title": "(11:05) 인천 출발",
        "note": "- [KE917] 13시간 25분",
        "costItems": [
          {
            "category": "숙소",
            "currency": "KRW",
            "amount": 2962972.0,
            "headcount": 3.0
          }
        ]
      },
      {
        "time": "17:00",
        "title": "(17:30) 취리히 도착",
        "note": ""
      },
      {
        "time": "18:00",
        "title": "입국심사 및 저녁식사",
        "note": ""
      },
      {
        "time": "19:00",
        "title": "(19:32) 인터라켄 이동",
        "note": "- 이후 열차 출발 시간: 20:02, 20:10,21:02 (Zurich Flughafen → Interlaken)\n- 기차 예매 6개월 전에 열림 ★ 3월에 예약 필요 ★ Saver Day Pass로 예약하기",
        "costItems": [
          {
            "category": "기차",
            "currency": "KRW",
            "amount": 304986.0,
            "headcount": 3.0
          }
        ]
      },
      {
        "time": "21:00",
        "title": "(21:30) 인터라켄 동역",
        "note": ""
      },
      {
        "time": "22:00",
        "title": "숙소 체크인",
        "note": ""
      }
    ]
  },
  {
    "id": "d2026-09-27",
    "date": "2026-09-27",
    "dateLabel": "9/27(일)",
    "region": "그린델발트",
    "timeBlocks": [
      {
        "time": "07:00",
        "title": "융프라우VIP패스 구매\n그린델발트 이동",
        "note": "- 융프라우 좌석 예약하기\n- [융프라우VIP패스] 인터라켄 동역에서 출발 ★ 창가자리 ★ 2일권",
        "locationTag": "그린델발트",
        "costItems": [
          {
            "category": "기차",
            "currency": "CHF",
            "amount": 215.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "08:00",
        "title": "피르스트 곤돌라",
        "note": "- 쿱마트 장보기 (간식,피크닉 할 경우 점심)\n- [융프라우VIP패스] 08:00~17:00, 20~30분 소요 ★ 오픈런하기 ★"
      },
      {
        "time": "09:00",
        "title": "피르스트 클리프워크",
        "note": "- 왕복 6km (편도 40~50분, 난이도 낮음) ★ 모자,선글라스,간식,돗자리 ★"
      },
      {
        "time": "10:00",
        "title": "비프알프제 하이킹",
        "note": "- 왕복 2시간"
      },
      {
        "time": "12:00",
        "title": "비프알프제 피크닉 or 피르스트 점심",
        "note": ""
      },
      {
        "time": "14:00",
        "title": "피르스트 곤돌라",
        "note": ""
      },
      {
        "time": "15:00",
        "title": "(15:17) 인터라켄 이동",
        "note": ""
      },
      {
        "time": "16:00",
        "title": "(16:03) 이젤발트 이동\n(16:30) 이젤발트 도착",
        "note": "- [융프라우VIP패스] 103번 버스로 이동 (완행 탑승 시 브리엔츠 호수 루트)"
      },
      {
        "time": "18:00",
        "title": "(18:17) 인터라켄행 페리 탑승\n(18:53) 인터라켄 도착",
        "note": "- [융프라우VIP패스] 이젤발트 페리 선착장"
      },
      {
        "time": "19:00",
        "title": "인터라켄 시내 관광",
        "note": ""
      }
    ]
  },
  {
    "id": "d2026-09-28",
    "date": "2026-09-28",
    "dateLabel": "9/28(월)",
    "region": "융프라우",
    "timeBlocks": [
      {
        "time": "08:00",
        "title": "",
        "note": "★ 날씨 미리 확인하기 ★ → 날씨에 따라 일정 변경 가능, 산악열차 자리 예약",
        "locationTag": "융프라우"
      },
      {
        "time": "09:00",
        "title": "(9:05) 융프라우 이동",
        "note": "- [융프라우VIP패스] 열차는 6:35부터 30분 간격 운행 (인터라켄 서역 기준, 2~3시간 소요)"
      },
      {
        "time": "11:00",
        "title": "(11:22) 융프라우 도착",
        "note": "- [융프라우VIP패스] 신라면 무료(피칸투스 라운지 바이 에딩거)"
      },
      {
        "time": "14:00",
        "title": "(14:30) 인터라켄 이동",
        "note": "- 9:30부터 1시간 간격으로 운행 (막차: 16:40)"
      },
      {
        "time": "16:00",
        "title": "(16:54) 인터라켄 도착",
        "note": ""
      },
      {
        "time": "17:00",
        "title": "쿱마트 장보기",
        "note": ""
      },
      {
        "time": "19:00",
        "title": "(19:10) 하더쿨름 이동\n(19:18) 하더쿨룸 도착",
        "note": "- [융프라우VIP패스] 푸니쿨라 탑승 (19:10, 19:40, 20:10, 20:40 운행), 웨이팅 있음\n- 융푸라우VIP패스 제시 시 하더쿨름 레스토랑 특정 메뉴 추가 할인"
      },
      {
        "time": "20:00",
        "title": "(20:10) 인터라켄 이동",
        "note": "- 푸니쿨라 탑승 (20:10, 20:40, 21:10, 21:40)"
      }
    ]
  },
  {
    "id": "d2026-09-29",
    "date": "2026-09-29",
    "dateLabel": "9/29(화)",
    "region": "인터라켄",
    "timeBlocks": [
      {
        "time": "06:00",
        "title": "인터라켄에서 휴식",
        "note": ""
      }
    ]
  },
  {
    "id": "d2026-09-30",
    "date": "2026-09-30",
    "dateLabel": "9/30(수)",
    "region": "체르마트",
    "timeBlocks": [
      {
        "time": "09:00",
        "title": "숙소 체크아웃\n(9:29) 체르마트 이동",
        "note": "",
        "costItems": [
          {
            "category": "물품보관함",
            "currency": "CHF",
            "amount": 132.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "11:00",
        "title": "(11:17) 체르마트 도착\n고르너그라트 전망대 이동",
        "note": "- 물품보관함에 짐 보관 (숙소 체크인 시간에 따라)\n★ 오른쪽에 앉아야 마테호른 보면서 올라갈 수 있음 ★ 40분 정도 소요",
        "locationTag": "체르마트",
        "costItems": [
          {
            "category": "기차",
            "currency": "KRW",
            "amount": 303124.0,
            "headcount": 3.0
          }
        ]
      },
      {
        "time": "12:00",
        "title": "점심식사",
        "note": "",
        "costItems": [
          {
            "category": "숙소",
            "currency": "KRW",
            "amount": 643640.0,
            "headcount": 3.0
          }
        ]
      },
      {
        "time": "13:00",
        "title": "로덴보텐 이동 후 리펠베르그 하이킹",
        "note": "- Alpine Garden 나무문, 리펠제 호수, 1시간 정도 소요"
      },
      {
        "time": "15:00",
        "title": "(15:18) 체르마트 이동\n(15:50) 체르마트 도착",
        "note": "- 17시대 까지 35분마다 열차 운행, 이후 18:50 막차"
      },
      {
        "time": "16:00",
        "title": "숙소 체크인",
        "note": ""
      },
      {
        "time": "17:00",
        "title": "체르마트 시내 관광, 쿱마트 장보기",
        "note": "- 체르마트 쿱마트는 20시 영업종료"
      },
      {
        "time": "22:00",
        "title": "야경보기",
        "note": "★ 은하수 별 ★"
      }
    ]
  },
  {
    "id": "d2026-10-01",
    "date": "2026-10-01",
    "dateLabel": "10/01(목)",
    "region": "베네치아",
    "timeBlocks": [
      {
        "time": "06:00",
        "title": "황금호른 보러가기",
        "note": "★ 일출시간 확인 필요 ★ 구글맵에 마테호른 뷰포인트 검색"
      },
      {
        "time": "08:00",
        "title": "조식",
        "note": "",
        "locationTag": "베네치아"
      },
      {
        "time": "10:00",
        "title": "숙소 체크아웃",
        "note": "",
        "costItems": [
          {
            "category": "기차",
            "currency": "KRW",
            "amount": 303833.0,
            "headcount": 3.0
          }
        ]
      },
      {
        "time": "11:00",
        "title": "밀라노 이동\n(11:06/11:37) 체르마트→비스프",
        "note": "- 체르마트→브리그→도모도솔라(국경구간,환승X)→밀라노 \n- SBB앱에서 티켓 구매",
        "costItems": [
          {
            "category": "기차",
            "currency": "KRW",
            "amount": 32715.0,
            "headcount": 3.0
          }
        ]
      },
      {
        "time": "13:00",
        "title": "(12:44) 비스프→밀라노 중앙역",
        "note": "",
        "costItems": [
          {
            "category": "기차(왕복)",
            "currency": "EUR",
            "amount": 191.7,
            "headcount": 3.0
          }
        ]
      },
      {
        "time": "14:00",
        "title": "(14:55) 밀라노 도착",
        "note": ""
      },
      {
        "time": "15:00",
        "title": "(15:25) 밀라노→베네치아",
        "note": "- trenitalia앱에서 티켓 구매"
      },
      {
        "time": "18:00",
        "title": "(18:50) 베네치아 도착",
        "note": "",
        "costItems": [
          {
            "category": "숙소",
            "currency": "KRW",
            "amount": 1175178.0,
            "headcount": 3.0
          }
        ]
      },
      {
        "time": "19:00",
        "title": "숙소 체크인",
        "note": ""
      },
      {
        "time": "20:00",
        "title": "저녁식사",
        "note": "Al Grill (티본스테이크)"
      }
    ]
  },
  {
    "id": "d2026-10-02",
    "date": "2026-10-02",
    "dateLabel": "10/02(금)",
    "region": "베네치아",
    "timeBlocks": [
      {
        "time": "08:00",
        "title": "베네치아 투어",
        "note": "- (부라노/무라노 섬 투어) 8:20~14:20\n- (부라노/무라노/본섬 투어) 9:00~16:30",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 95000.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "17:00",
        "title": "베네치아 야경투어 (별밤투어)",
        "note": "- 17:00~20:00",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 37500.0,
            "headcount": 1.0
          }
        ]
      }
    ]
  },
  {
    "id": "d2026-10-03",
    "date": "2026-10-03",
    "dateLabel": "10/03(토)",
    "region": "베네치아",
    "timeBlocks": [
      {
        "time": "10:00",
        "title": "(10:10) 밀라노 이동",
        "note": "",
        "costItems": [
          {
            "category": "숙소",
            "currency": "KRW",
            "amount": 551660.0,
            "headcount": 3.0
          }
        ]
      },
      {
        "time": "12:00",
        "title": "",
        "note": "★ 밀라노는 음식보다 디저트(커피,빵집)가 맛있음 ★"
      },
      {
        "time": "13:00",
        "title": "(13:35) 밀라노 도착",
        "note": "",
        "locationTag": "밀라노"
      },
      {
        "time": "14:00",
        "title": "점심식사",
        "note": "San Giorgio Ristorante - Pizzeria del 1999 (씨푸드 파스타, 화덕피자, 하우스와인)"
      },
      {
        "time": "16:00",
        "title": "카페",
        "note": "스타벅스 리저브 로스터리 밀라노"
      },
      {
        "time": "19:00",
        "title": "저녁식사",
        "note": ""
      },
      {
        "time": "20:00",
        "title": "야경보기 - 밀라노 대성당",
        "note": ""
      }
    ]
  },
  {
    "id": "d2026-10-04",
    "date": "2026-10-04",
    "dateLabel": "10/04(일)",
    "region": "밀라노",
    "timeBlocks": [
      {
        "time": "08:00",
        "title": "아침식사",
        "note": "Pave"
      },
      {
        "time": "09:00",
        "title": "두오모 성당 & 브레라 미술관 투어",
        "note": "- 9:30~13:00"
      },
      {
        "time": "14:00",
        "title": "점심 겸 저녁",
        "note": "Mamma Rosa Osteria (스테이크, 봉골레 파스타)"
      },
      {
        "time": "18:00",
        "title": "[선일] 공항 이동",
        "note": "- 말펜사 익스프레스 30~50분(30분 간격), 공항버스 50분(20~30분 간격)"
      },
      {
        "time": "22:00",
        "title": "",
        "note": "- 선일 비행기 (22:00)"
      }
    ]
  },
  {
    "id": "d2026-10-05",
    "date": "2026-10-05",
    "dateLabel": "10/05(월)",
    "region": "밀라노",
    "timeBlocks": [
      {
        "time": "09:00",
        "title": "(9:05) 피렌체 이동",
        "note": "",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 113500.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "10:00",
        "title": "(10:50) 피렌체 도착",
        "note": "",
        "locationTag": "피렌체"
      },
      {
        "time": "11:00",
        "title": "산 로렌초 성당\n메디체아 라우렌치아나 도서관",
        "note": "",
        "costItems": [
          {
            "category": "입장료",
            "currency": "EUR",
            "amount": 9.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "12:00",
        "title": "팔라초 메디치 리카르디 궁전\n피렌체 대성당 & 두오모 쿠폴라 전망대",
        "note": "성당 방문 시 패스 예약 필요",
        "costItems": [
          {
            "category": "입장료",
            "currency": "EUR",
            "amount": 40.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "14:00",
        "title": "점심식사",
        "note": "달오스떼 본점 (스테이크 & 파스타)"
      },
      {
        "time": "15:00",
        "title": "숙소 체크인",
        "note": "- 얼리 체크인 가능 여부 확인"
      },
      {
        "time": "18:00",
        "title": "베키오 다리",
        "note": "- 1345년에 재건된 다리, 아르노강에 있는 다리 중 가장 오래된 다리"
      },
      {
        "time": "19:00",
        "title": "저녁식사",
        "note": ""
      },
      {
        "time": "20:00",
        "title": "미켈란젤로 광장",
        "note": "- 야경"
      },
      {
        "time": "21:00",
        "title": "",
        "note": "- 아페롤 스프리트 (이탈리아 칵테일)"
      }
    ]
  },
  {
    "id": "d2026-10-06",
    "date": "2026-10-06",
    "dateLabel": "10/06(화)",
    "region": "피렌체",
    "timeBlocks": [
      {
        "time": "08:00",
        "title": "(8:40) 투어 시작",
        "note": "- 피렌체 더몰 + 피사 투어",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 134694.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "18:00",
        "title": "피렌체 도착",
        "note": ""
      }
    ]
  },
  {
    "id": "d2026-10-07",
    "date": "2026-10-07",
    "dateLabel": "10/07(수)",
    "region": "피렌체",
    "timeBlocks": [
      {
        "time": "06:00",
        "title": "",
        "note": "- 시내 관광"
      },
      {
        "time": "07:00",
        "title": "",
        "note": "- 키포인트(Ki Point)에 짐 맡기고 투어가기"
      },
      {
        "time": "08:00",
        "title": "",
        "note": "- 화요일~일요일 8:15~18:30",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 50000.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "09:00",
        "title": "우피치 미술관",
        "note": "",
        "costItems": [
          {
            "category": "미술관 입장료",
            "currency": "EUR",
            "amount": 29.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "10:00",
        "title": "",
        "note": "",
        "costItems": [
          {
            "category": "수신기 대여",
            "currency": "EUR",
            "amount": 3.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "11:00",
        "title": "",
        "note": "",
        "costItems": [
          {
            "category": "기타",
            "currency": "KRW",
            "amount": 104720.0,
            "headcount": 1
          }
        ]
      },
      {
        "time": "12:00",
        "title": "(12:30) 투어 종료",
        "note": ""
      },
      {
        "time": "13:00",
        "title": "알란티코 비나이오",
        "note": "샌드위치"
      },
      {
        "time": "14:00",
        "title": "로마 이동",
        "note": "",
        "locationTag": "로마"
      }
    ]
  },
  {
    "id": "d2026-10-08",
    "date": "2026-10-08",
    "dateLabel": "10/08(목)",
    "region": "남부투어",
    "timeBlocks": [
      {
        "time": "06:00",
        "title": "(6:15) 남부투어",
        "note": "",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 620000.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "07:00",
        "title": "나폴리",
        "note": "",
        "locationTag": "남부투어",
        "costItems": [
          {
            "category": "수신기 대여",
            "currency": "EUR",
            "amount": 5.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "08:00",
        "title": "폼페이",
        "note": ""
      },
      {
        "time": "12:00",
        "title": "점심식사",
        "note": "",
        "costItems": [
          {
            "category": "식사",
            "currency": "EUR",
            "amount": 15.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "18:00",
        "title": "저녁식사",
        "note": ""
      }
    ]
  },
  {
    "id": "d2026-10-09",
    "date": "2026-10-09",
    "dateLabel": "10/09(금)",
    "region": "남부투어",
    "timeBlocks": [
      {
        "time": "06:00",
        "title": "소렌토",
        "note": ""
      },
      {
        "time": "07:00",
        "title": "포지타노",
        "note": ""
      },
      {
        "time": "08:00",
        "title": "아말피마을",
        "note": "",
        "costItems": [
          {
            "category": "해안도로",
            "currency": "EUR",
            "amount": 20.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "09:00",
        "title": "아말피 해상 페리투어",
        "note": ""
      },
      {
        "time": "12:00",
        "title": "점심식사",
        "note": ""
      },
      {
        "time": "18:00",
        "title": "저녁식사",
        "note": ""
      }
    ]
  },
  {
    "id": "d2026-10-10",
    "date": "2026-10-10",
    "dateLabel": "10/10(토)",
    "region": "남부투어",
    "timeBlocks": [
      {
        "time": "06:00",
        "title": "나폴리 항구",
        "note": ""
      },
      {
        "time": "07:00",
        "title": "카프리섬 (페리 50분)",
        "note": "",
        "costItems": [
          {
            "category": "카프리섬",
            "currency": "EUR",
            "amount": 135.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "08:00",
        "title": "푸른동굴",
        "note": ""
      },
      {
        "time": "09:00",
        "title": "아나카프리/몬테솔라로/악셀문테 거리",
        "note": ""
      },
      {
        "time": "13:00",
        "title": "카프리 시내",
        "note": ""
      },
      {
        "time": "14:00",
        "title": "마리나 그란데 항구",
        "note": ""
      },
      {
        "time": "19:00",
        "title": "로마 도착",
        "note": "더 로마헬로(호스텔)",
        "locationTag": "로마"
      }
    ]
  },
  {
    "id": "d2026-10-11",
    "date": "2026-10-11",
    "dateLabel": "10/11(일)",
    "region": "로마",
    "timeBlocks": [
      {
        "time": "06:00",
        "title": "휴식",
        "note": ""
      },
      {
        "time": "07:00",
        "title": "자유일정",
        "note": ""
      },
      {
        "time": "08:00",
        "title": "",
        "note": "",
        "locationTag": "자유일정",
        "costItems": [
          {
            "category": "기타",
            "currency": "KRW",
            "amount": 69000.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "13:00",
        "title": "",
        "note": "",
        "costItems": [
          {
            "category": "기타",
            "currency": "KRW",
            "amount": 28.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "14:00",
        "title": "",
        "note": "",
        "costItems": [
          {
            "category": "기타",
            "currency": "KRW",
            "amount": 3.0,
            "headcount": 1.0
          }
        ]
      }
    ]
  },
  {
    "id": "d2026-10-12",
    "date": "2026-10-12",
    "dateLabel": "10/12(월)",
    "region": "바티칸",
    "timeBlocks": [
      {
        "time": "06:00",
        "title": "(6:30) 바티칸 투어",
        "note": "",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 69000.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "07:00",
        "title": "",
        "note": "",
        "locationTag": "바티칸",
        "costItems": [
          {
            "category": "입장료",
            "currency": "EUR",
            "amount": 20.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "08:00",
        "title": "",
        "note": "",
        "costItems": [
          {
            "category": "수신기 대여",
            "currency": "EUR",
            "amount": 3.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "13:00",
        "title": "투어 종료",
        "note": ""
      },
      {
        "time": "14:00",
        "title": "",
        "note": "로마 자유시간"
      }
    ]
  },
  {
    "id": "d2026-10-13",
    "date": "2026-10-13",
    "dateLabel": "10/13(화)",
    "region": "로마",
    "timeBlocks": [
      {
        "time": "07:00",
        "title": "토스카나 투어",
        "note": "",
        "locationTag": "로마",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 250000.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "08:00",
        "title": "치비타 디 반뇨레죠",
        "note": "- 천공의 성 라퓨타",
        "locationTag": "토스카나",
        "costItems": [
          {
            "category": "입장료",
            "currency": "EUR",
            "amount": 8.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "10:00",
        "title": "Palazzo 와이너리",
        "note": "",
        "costItems": [
          {
            "category": "식사",
            "currency": "EUR",
            "amount": 45.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "14:00",
        "title": "발도르챠 평원",
        "note": ""
      },
      {
        "time": "18:00",
        "title": "로마 도착",
        "note": ""
      }
    ]
  },
  {
    "id": "d2026-10-14",
    "date": "2026-10-14",
    "dateLabel": "10/14(수)",
    "region": "로마",
    "timeBlocks": [
      {
        "time": "07:00",
        "title": "",
        "note": "",
        "locationTag": "로마",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 75000.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "08:00",
        "title": "",
        "note": "",
        "locationTag": "시내구경",
        "costItems": [
          {
            "category": "기차&푸니쿨라",
            "currency": "EUR",
            "amount": 30.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "09:00",
        "title": "산타 마리아 마조레 대성당",
        "note": ""
      },
      {
        "time": "10:00",
        "title": "공화국 광장",
        "note": ""
      },
      {
        "time": "11:00",
        "title": "산타마리아 델리 안젤라 성당",
        "note": ""
      },
      {
        "time": "12:00",
        "title": "점심식사",
        "note": ""
      },
      {
        "time": "13:00",
        "title": "트래비 분수",
        "note": ""
      },
      {
        "time": "14:00",
        "title": "스페인광장",
        "note": "소매치기 조심"
      },
      {
        "time": "15:00",
        "title": "브로게세 미술관",
        "note": "예약하기"
      },
      {
        "time": "16:00",
        "title": "브로게세 공원 산책",
        "note": ""
      },
      {
        "time": "17:00",
        "title": "저녁식사",
        "note": ""
      },
      {
        "time": "18:00",
        "title": "야경투어",
        "note": "로마 도착해서 예약하기"
      },
      {
        "time": "19:00",
        "title": "포폴로 광장",
        "note": "야경"
      }
    ]
  },
  {
    "id": "d2026-10-15",
    "date": "2026-10-15",
    "dateLabel": "10/15(목)",
    "region": "로마",
    "timeBlocks": [
      {
        "time": "08:00",
        "title": "(8:00)",
        "note": "콜로세움 투어",
        "locationTag": "콜로세움",
        "costItems": [
          {
            "category": "투어",
            "currency": "KRW",
            "amount": 75000.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "13:00",
        "title": "점심식사",
        "note": "투어 종료",
        "costItems": [
          {
            "category": "콜로세움 통합권",
            "currency": "EUR",
            "amount": 28.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "14:00",
        "title": "대전차 경기장",
        "note": "",
        "costItems": [
          {
            "category": "수신기 대여",
            "currency": "EUR",
            "amount": 3.0,
            "headcount": 1.0
          }
        ]
      },
      {
        "time": "15:00",
        "title": "진실의 입",
        "note": ""
      },
      {
        "time": "16:00",
        "title": "캄피돌리오 광장 & 박물관",
        "note": ""
      },
      {
        "time": "19:00",
        "title": "저녁식사",
        "note": ""
      }
    ]
  },
  {
    "id": "d2026-10-16",
    "date": "2026-10-16",
    "dateLabel": "10/16(금)",
    "region": "자유일정",
    "timeBlocks": [
      {
        "time": "06:00",
        "title": "",
        "note": "로마 자유시간"
      },
      {
        "time": "07:00",
        "title": "",
        "note": "카레 & 젤라또",
        "locationTag": "자유일정"
      },
      {
        "time": "08:00",
        "title": "",
        "note": "쇼핑"
      },
      {
        "time": "09:00",
        "title": "",
        "note": "산타 마리아 노벨라 약국"
      },
      {
        "time": "10:00",
        "title": "",
        "note": "만치니 - 가죽 제품"
      }
    ]
  },
  {
    "id": "d2026-10-17",
    "date": "2026-10-17",
    "dateLabel": "10/17(토)",
    "region": "로마 → 인천",
    "timeBlocks": [
      {
        "time": "11:00",
        "title": "체크아웃",
        "note": ""
      },
      {
        "time": "15:00",
        "title": "공항 출발",
        "note": ""
      },
      {
        "time": "21:00",
        "title": "(21:25) 로마 출발",
        "note": "",
        "costItems": [
          {
            "category": "비행기",
            "currency": "KRW",
            "amount": 1389200.0,
            "headcount": 1.0
          }
        ]
      }
    ]
  },
  {
    "id": "d2026-10-18",
    "date": "2026-10-18",
    "dateLabel": "10/18(일)",
    "region": "로마 → 인천",
    "timeBlocks": [
      {
        "time": "15:00",
        "title": "(15:55) 인천 도착",
        "note": ""
      }
    ]
  }
];
