import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { db } from "./firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import NanumGothic from "./jsfonts/NanumGothic-normal.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, ChartDataLabels);

const allowedEmails = [
  "jjjjwon233@gmail.com",
  "yeojeongcho@gmail.com",
  "wjdtjs797@gmail.com",
  "ssoniii0904@gmail.com",
  "fatroid@gmail.com"
];

function scoreOrderValue(label) {
  const yearMap = { 중: 0, 고: 1000 };
  const termMap = {
    "1학기 중간": 1,
    "1학기 기말": 2,
    "2학기 중간": 3,
    "2학기 기말": 4,
    "3월": 5,
    "6월": 6,
    "9월": 7,
    "10월": 8,
  };
  const match = label.match(/([중고])([1-3]) (.+)/);
  if (!match) return 9999;
  const [, level, grade, period] = match;
  return yearMap[level] + parseInt(grade) * 100 + (termMap[period] || 0);
}

function App() {
  const [students, setStudents] = useState([]);
  const [user, setUser] = useState(null);
  const [newStudent, setNewStudent] = useState({ name: "", school: "중학교", grade: 1, teacher: "" });
  const [newScore, setNewScore] = useState({ studentId: "", type: "내신", date: "", score: 0 });
  const [searchName, setSearchName] = useState("");
  const [searchSchool, setSearchSchool] = useState("");
  const [searchGrade, setSearchGrade] = useState("");

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && !allowedEmails.includes(currentUser.email)) {
        alert("허용되지 않은 사용자입니다.");
        signOut(auth);
        return;
      }
      setUser(currentUser);
      if (currentUser) fetchStudents();
    });
    return () => unsubscribe();
  }, []);

  const fetchStudents = async () => {
    const snapshot = await getDocs(collection(db, "students"));
    const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setStudents(list);
  };

  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    signInWithPopup(auth, provider)
      .then(() => alert("✅ Google 로그인 성공"))
      .catch(() => alert("❌ Google 로그인 실패"));
  };

  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth);
  };

  const addStudent = async () => {
    await addDoc(collection(db, "students"), { ...newStudent, scores: [] });
    fetchStudents();
  };

  const addScore = async () => {
    const studentRef = doc(db, "students", newScore.studentId);
    const student = students.find((s) => s.id === newScore.studentId);
    const updatedScores = [...(student.scores || []), {
      type: newScore.type,
      date: newScore.date,
      score: Number(newScore.score)
    }];
    await updateDoc(studentRef, { scores: updatedScores });
    fetchStudents();
  };

  const deleteStudent = async (id) => {
    await deleteDoc(doc(db, "students", id));
    fetchStudents();
  };

  const deleteScore = async (studentId, index) => {
    const studentRef = doc(db, "students", studentId);
    const student = students.find((s) => s.id === studentId);
    const updatedScores = student.scores.filter((_, i) => i !== index);
    await updateDoc(studentRef, { scores: updatedScores });
    fetchStudents();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.addFileToVFS("NanumGothic.ttf", NanumGothic);
    doc.addFont("NanumGothic.ttf", "NanumGothic", "normal");
    doc.setFont("NanumGothic");

    const rows = [];
    students.forEach(s => {
      s.scores.forEach(score => {
        rows.push([s.name, s.school, s.grade, s.teacher, score.type, score.date, score.score]);
      });
    });
    autoTable(doc, {
      head: [["이름", "학교", "학년", "담임", "성적 종류", "시기", "점수"]],
      body: rows
    });
    doc.save("students_scores.pdf");
  };

  const exportToExcel = () => {
    const rows = [];
    students.forEach(s => {
      s.scores.forEach(score => {
        rows.push({ 이름: s.name, 학교: s.school, 학년: s.grade, 담임: s.teacher, 종류: score.type, 시기: score.date, 점수: score.score });
      });
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "성적");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([excelBuffer]), "students_scores.xlsx");
  };

  const filteredStudents = students.filter((s) =>
    s.name.includes(searchName) &&
    s.school.includes(searchSchool) &&
    (searchGrade === "" || s.grade === parseInt(searchGrade))
  );

  return (
    <div style={{ padding: 20 }}>
      {!user ? (
        <div>
          <h2>로그인</h2>
          <button onClick={handleGoogleLogin}>Google로 로그인</button>
        </div>
      ) : (
        <div>
          <h2>성적 관리 시스템 <button onClick={handleLogout}>로그아웃</button></h2>

          <input placeholder="학생 이름 검색" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
          <input placeholder="학교 검색" value={searchSchool} onChange={(e) => setSearchSchool(e.target.value)} />
          <input placeholder="학년 검색" value={searchGrade} onChange={(e) => setSearchGrade(e.target.value)} />

          <h3>학생 추가</h3>
          <input placeholder="이름" onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} />
          <input placeholder="학교" onChange={(e) => setNewStudent({ ...newStudent, school: e.target.value })} />
          <input placeholder="학년" type="number" onChange={(e) => setNewStudent({ ...newStudent, grade: parseInt(e.target.value) })} />
          <input placeholder="담임" onChange={(e) => setNewStudent({ ...newStudent, teacher: e.target.value })} />
          <button onClick={addStudent}>학생 추가</button>

          <h3>성적 추가</h3>
          <select onChange={(e) => setNewScore({ ...newScore, studentId: e.target.value })}>
            <option value="">학생 선택</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select onChange={(e) => setNewScore({ ...newScore, type: e.target.value })}>
            <option value="내신">내신</option>
            <option value="모의고사">모의고사</option>
          </select>
          <input placeholder="시기" onChange={(e) => setNewScore({ ...newScore, date: e.target.value })} />
          <input placeholder="점수" type="number" onChange={(e) => setNewScore({ ...newScore, score: parseInt(e.target.value) })} />
          <button onClick={addScore}>성적 추가</button>

          <button onClick={exportToPDF}>PDF로 내보내기</button>
          <button onClick={exportToExcel}>엑셀로 내보내기</button>

          {filteredStudents.map((s) => {
            const scoresByType = type => (s.scores || []).filter(score => score.type === type).sort((a, b) => scoreOrderValue(a.date) - scoreOrderValue(b.date));
            const makeChartData = (type) => {
              const sorted = scoresByType(type);
              return {
                labels: sorted.map(sc => sc.date),
                datasets: [{
                  label: type,
                  data: sorted.map(sc => sc.score),
                  borderColor: type === "내신" ? "blue" : "green",
                  fill: false,
                  tension: 0.3
                }]
              };
            };
            const chartOptions = {
              plugins: {
                datalabels: {
                  anchor: 'end', align: 'top', font: { weight: 'bold' }
                }
              }
            };
            const avg = arr => arr.length === 0 ? 0 : (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);

            return (
              <div key={s.id} style={{ marginTop: 30 }}>
                <h3>{s.name} - {s.school} {s.grade}학년 <button onClick={() => deleteStudent(s.id)}>학생 삭제</button></h3>
                <div style={{ display: 'flex', gap: 50 }}>
                  {["내신", "모의고사"].map(type => {
                    const sorted = scoresByType(type);
                    return (
                      <div key={type}>
                        <h4>{type} 성적표</h4>
                        <table border="1">
                          <thead><tr><th>시기</th><th>점수</th><th></th></tr></thead>
                          <tbody>
                            {sorted.map((sc, i) => (
                              <tr key={i}>
                                <td>{sc.date}</td><td>{sc.score}</td>
                                <td><button onClick={() => deleteScore(s.id, s.scores.indexOf(sc))}>삭제</button></td>
                              </tr>
                            ))}
                            <tr><td>평균</td><td>{avg(sorted.map(s => s.score))}</td><td></td></tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 50, marginTop: 20 }}>
                  <div style={{ width: '45%' }}><Line data={makeChartData("내신")} options={chartOptions} plugins={[ChartDataLabels]} /></div>
                  <div style={{ width: '45%' }}><Line data={makeChartData("모의고사")} options={chartOptions} plugins={[ChartDataLabels]} /></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default App;
