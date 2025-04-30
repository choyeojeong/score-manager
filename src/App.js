import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { db } from "./firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, ChartDataLabels);

const allowedEmails = [
  "jjjjwon233@gmail.com",
  "yeojeongcho@gmail.com",
  "wjdtjs797@gmail.com ",
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

  const exportToPDF = () => {
    const doc = new jsPDF();
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

  const exportToExcel = () => {
    const wsData = [["이름", "학교", "학년", "담임", "성적 종류", "시기", "점수"]];
    students.forEach(s => {
      s.scores.forEach(score => {
        wsData.push([s.name, s.school, s.grade, s.teacher, score.type, score.date, score.score]);
      });
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Scores");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "students_scores.xlsx");
  };

  const addStudent = async () => {
    if (!newStudent.name) return;
    await addDoc(collection(db, "students"), { ...newStudent, scores: [] });
    fetchStudents();
  };

  const addScore = async () => {
    if (!newScore.studentId) return;
    const studentRef = doc(db, "students", newScore.studentId);
    const student = students.find(s => s.id === newScore.studentId);
    const updatedScores = [...student.scores, {
      type: newScore.type,
      date: newScore.date,
      score: Number(newScore.score),
    }];
    await updateDoc(studentRef, { scores: updatedScores });
    fetchStudents();
  };

  const deleteStudent = async (id) => {
    await deleteDoc(doc(db, "students", id));
    fetchStudents();
  };

  const deleteScore = async (studentId, index) => {
    const student = students.find(s => s.id === studentId);
    const updatedScores = [...student.scores];
    updatedScores.splice(index, 1);
    await updateDoc(doc(db, "students", studentId), { scores: updatedScores });
    fetchStudents();
  };

  const makeChartData = (type, s) => {
    const sorted = s.scores.filter(score => score.type === type).sort((a, b) => scoreOrderValue(a.date) - scoreOrderValue(b.date));
    return {
      labels: sorted.map(s => s.date),
      datasets: [{
        label: type,
        data: sorted.map(s => s.score),
        borderColor: type === "내신" ? "#42a5f5" : "#66bb6a",
        fill: false,
        datalabels: {
          align: 'top',
          anchor: 'end',
          formatter: (value) => value,
          color: '#000'
        }
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      datalabels: {
        display: true,
        color: '#000',
        align: 'top',
        font: {
          weight: 'bold'
        }
      }
    }
  };

  const ScoreTable = ({ scores, type, studentId }) => {
    const filtered = scores.filter(s => s.type === type);
    const avg = filtered.length ? (filtered.reduce((sum, s) => sum + s.score, 0) / filtered.length).toFixed(2) : 0;
    return (
      <div style={{ flex: 1 }}>
        <h4>{type} 성적표</h4>
        <table border="1" cellPadding="5">
          <thead>
            <tr><th>시기</th><th>점수</th><th>삭제</th></tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i}>
                <td>{s.date}</td>
                <td>{s.score}</td>
                <td><button onClick={() => deleteScore(studentId, students.find(stu => stu.id === studentId).scores.indexOf(s))}>삭제</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>평균</td><td>{avg}</td><td></td></tr>
          </tfoot>
        </table>
      </div>
    );
  };

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h2>로그인</h2>
        <button onClick={handleGoogleLogin}>Google로 로그인</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <button onClick={handleLogout}>로그아웃</button>
      <button onClick={exportToPDF}>PDF로 내보내기</button>
      <button onClick={exportToExcel}>엑셀로 내보내기</button>

      <h3>학생 추가</h3>
      <input placeholder="이름" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
      <input placeholder="학교" value={newStudent.school} onChange={e => setNewStudent({ ...newStudent, school: e.target.value })} />
      <input placeholder="학년" type="number" value={newStudent.grade} onChange={e => setNewStudent({ ...newStudent, grade: Number(e.target.value) })} />
      <input placeholder="담임" value={newStudent.teacher} onChange={e => setNewStudent({ ...newStudent, teacher: e.target.value })} />
      <button onClick={addStudent}>학생 추가</button>

      <h3>성적 추가</h3>
      <select value={newScore.studentId} onChange={e => setNewScore({ ...newScore, studentId: e.target.value })}>
        <option value="">학생 선택</option>
        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select value={newScore.type} onChange={e => setNewScore({ ...newScore, type: e.target.value })}>
        <option value="내신">내신</option>
        <option value="모의고사">모의고사</option>
      </select>
      <input placeholder="시기" value={newScore.date} onChange={e => setNewScore({ ...newScore, date: e.target.value })} />
      <input type="number" placeholder="점수" value={newScore.score} onChange={e => setNewScore({ ...newScore, score: e.target.value })} />
      <button onClick={addScore}>성적 추가</button>

      {students.map(s => (
        <div key={s.id} style={{ marginBottom: 50 }}>
          <h3>
            {s.name} - {s.school} {s.grade}학년
            <button onClick={() => deleteStudent(s.id)} style={{ marginLeft: 10 }}>삭제</button>
          </h3>
          <div style={{ display: 'flex', gap: 40, marginBottom: 20 }}>
            <ScoreTable scores={s.scores} type="내신" studentId={s.id} />
            <ScoreTable scores={s.scores} type="모의고사" studentId={s.id} />
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <Line data={makeChartData("내신", s)} options={chartOptions} />
            </div>
            <div style={{ flex: 1 }}>
              <Line data={makeChartData("모의고사", s)} options={chartOptions} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
