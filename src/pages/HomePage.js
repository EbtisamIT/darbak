import React from "react";
import { Link } from "react-router-dom";

const MovingGreenPath = () => {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* 🌌 خلفية نجوم محسّنة */}
      <div
        style={{
          position: "absolute",
          top: "-60px",
          left: "-80px",
          width: "300px",
          height: "200px",
          pointerEvents: "none",
          overflow: "visible",
          zIndex: 0,
        }}
      >
        {/* ⭐ نجوم */}
        <div className="star s1"></div>
        <div className="star s2"></div>
        <div className="star s3"></div>
        <div className="star s4"></div>

        {/* 🌠 شهاب ناعم */}
        <div className="shooting"></div>

        <style>
          {`
            .star {
              position: absolute;
              width: 4px;
              height: 4px;
              background: white;
              border-radius: 50%;
              opacity: 0.8;
              filter: drop-shadow(0 0 6px white);
              animation: twinkle 2.2s infinite ease-in-out;
            }

            .s1 { top: 10px; left: 40px; animation-delay: 0.3s; }
            .s2 { top: 90px; left: 140px; animation-delay: 1s; }
            .s3 { top: 45px; left: 200px; animation-delay: 1.6s; }
            .s4 { top: 120px; left: 70px; animation-delay: 2.2s; }

            @keyframes twinkle {
              0%, 100% { opacity: 0.3; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.2); }
            }

            .shooting {
              position: absolute;
              top: 40px;
              left: -40px;
              width: 120px;
              height: 2px;
              background: linear-gradient(90deg, white, transparent);
              opacity: 0;
              transform: rotate(25deg);
              filter: drop-shadow(0 0 4px white);
              animation: shoot 3.5s infinite ease-out;
            }

            @keyframes shoot {
              0% { transform: translateX(0) rotate(25deg); opacity: 0; }
              10% { opacity: 1; }
              40% { transform: translateX(160px) rotate(25deg); opacity: 0; }
              100% { opacity: 0; }
            }
          `}
        </style>
      </div>

      {/* العنوان */}
      <h1
        style={{
          fontSize: "42px",
          color: "hsl(150, 45.5%, 46%)",
          margin: 0,
          fontWeight: "700",
          position: "relative",
          zIndex: 2,
        }}
      >
        تعلّـم من تجارب غيرك ودربك خضـر
      </h1>

      {/* الطريق الأخضر */}
      <div
        style={{
          position: "absolute",
          bottom: "-12px",
          left: "0",
          width: "100%",
          height: "4px",
          background:
            "linear-gradient(90deg, transparent, hsl(150,45%,46%), transparent)",
          animation: "moveRoad 5s linear infinite",
          borderRadius: "20px",
        }}
      ></div>

      <style>
        {`
          @keyframes moveRoad {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}
      </style>
    </div>
  );
};

const HomePage = () => {
  return (
    <div
      style={{
        backgroundColor: "#0f1115",
        color: "#fff",
        minHeight: "calc(100vh - 80px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        fontFamily: "'Cairo', sans-serif",
        padding: "20px",
      }}
    >
      <MovingGreenPath />

      <p
        style={{
          fontSize: "19px",
          color: "#ccc",
          maxWidth: "600px",
          margin: "25px auto 35px auto",
          lineHeight: "1.8",
        }}
      >
        منصة <strong>دربك</strong> تساعد الطلاب والطالبات على اكتشاف أفضل
        تجارب التدريب التعاوني عبر مشاركة قصص حقيقية…  
        <br />
        لتكون بداية مشوارك المهني أوضح وأسهل.
      </p>

      <Link to="/experiences" style={{ textDecoration: "none" }}>
        <button
          style={{
            backgroundColor: "#7ddbcd",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "14px 40px",
            fontSize: "18px",
            cursor: "pointer",
            transition: "0.3s",
            boxShadow: "0 0 15px rgba(125,219,205,0.3)",
          }}
        >
          استعرض التجارب 🚀
        </button>
      </Link>
    </div>
  );
};

export default HomePage;
