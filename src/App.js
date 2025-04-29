import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement } from "chart.js";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { db } from "./firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

function App() {
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState({ school: "", grade: "", teacher: "" });
  const [newStudent, setNewStudent] = useState({ name: "", school: "중학교", grade: 1, teacher: "" });
  const [newScore, setNewScore] = useState({ studentId: "", type: "내신", date: "", score: 0 });

  useEffect(() => {
    const fetchStudents = async () => {
      const snapshot = await getDocs(collection(db, "students"));
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(list);
    };

    fetchStudents();
  }, []);

  const filteredStudents = students.filter(
    (s) =>
      (!filter.school || s.school === filter.school) &&
      (!filter.grade || s.grade === parseInt(filter.grade)) &&
      (!filter.teacher || s.teacher === filter.teacher)
  );

  const addStudent = async () => {
    const newStudentData = { ...newStudent, scores: [] };
    const docRef = await addDoc(collection(db, "students"), newStudentData);
    setStudents(prev => [...prev, { id: docRef.id, ...newStudentData }]);
  };

  const addScore = async () => {
    const student = students.find(s => s.id === newScore.studentId);
    if (!student) return;

    const updatedScores = [...student.scores, { ...newScore, score: parseInt(newScore.score), subject: "영어" }];
    const studentRef = doc(db, "students", student.id);
    await updateDoc(studentRef, { scores: updatedScores });

    setStudents(prev =>
      prev.map(s => (s.id === student.id ? { ...s, scores: updatedScores } : s))
    );
  };

  const deleteScore = async (studentId, index) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const updatedScores = student.scores.filter((_, i) => i !== index);
    const studentRef = doc(db, "students", studentId);
    await updateDoc(studentRef, { scores: updatedScores });

    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, scores: updatedScores } : s))
    );
  };

  const deleteStudent = async (studentId) => {
    await deleteDoc(doc(db, "students", studentId));
    setStudents(prev => prev.filter(s => s.id !== studentId));
  };

  const exportExcel = () => {
    const data = students.flatMap((s) =>
      s.scores.map((sc) => ({ name: s.name, school: s.school, grade: s.grade, teacher: s.teacher, ...sc }))
    );
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "성적");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "scores.xlsx");
  };

  const exportPdf = () => {
    window.print();
  };

  const graphData = (student, type) => {
    const scores = student.scores.filter((s) => s.type === type);
    const sorted = [...scores].sort((a, b) => a.date.localeCompare(b.date));
    return {
      labels: sorted.map((s) => s.date),
      datasets: [
        {
          label: `${type} 성적`,
          data: sorted.map((s) => s.score),
          borderColor: type === "내신" ? "blue" : "green",
        },
      ],
    };
  };

  const copyScores = () => {
    const data = students
      .map(
        (s) =>
          `${s.name} (${s.school} ${s.grade}학년, ${s.teacher})\n` +
          s.scores.map((sc) => ` - ${sc.type} ${sc.date} ${sc.subject}: ${sc.score}점`).join("\n")
      )
      .join("\n\n");
    navigator.clipboard.writeText(data);
    alert("복사되었습니다!");
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>성적 관리 시스템</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <select onChange={(e) => setFilter({ ...filter, school: e.target.value })}>
          <option value="">전체 학교</option>
          <option value="중학교">중학교</option>
          <option value="고등학교">고등학교</option>
        </select>
        <select onChange={(e) => setFilter({ ...filter, grade: e.target.value })}>
          <option value="">전체 학년</option>
          {[1, 2, 3].map((g) => (
            <option key={g} value={g}>{g}학년</option>
          ))}
        </select>
        <input placeholder="담당선생님" onChange={(e) => setFilter({ ...filter, teacher: e.target.value })} />
      </div>

      <button onClick={exportExcel}>엑셀로 내보내기</button>
      <button onClick={exportPdf}>PDF로 인쇄</button>
      <button onClick={copyScores}>복사하기</button>

      <h3>학생 추가</h3>
      <input placeholder="이름" onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} />
      <select onChange={(e) => setNewStudent({ ...newStudent, school: e.target.value })}>
        <option value="중학교">중학교</option>
        <option value="고등학교">고등학교</option>
      </select>
      <select onChange={(e) => setNewStudent({ ...newStudent, grade: parseInt(e.target.value) })}>
        {[1, 2, 3].map((g) => (
          <option key={g} value={g}>{g}학년</option>
        ))}
      </select>
      <input placeholder="담당선생님" onChange={(e) => setNewStudent({ ...newStudent, teacher: e.target.value })} />
      <button onClick={addStudent}>추가</button>

      <h4>성적 추가</h4>
      <select onChange={(e) => setNewScore({ ...newScore, studentId: e.target.value })}>
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select onChange={(e) => setNewScore({ ...newScore, type: e.target.value })}>
        <option value="내신">내신</option>
        <option value="모의고사">모의고사</option>
      </select>

      {newScore.type === "내신" ? (
        <select onChange={(e) => setNewScore({ ...newScore, date: e.target.value })}>
          <option value="">선택</option>
          {["중", "고"].flatMap((level) =>
            Array.from({ length: 3 }, (_, i) =>
              ["1학기 중간", "1학기 기말", "2학기 중간", "2학기 기말"].map((term) => `${level}${i + 1} ${term}`)
            ).flat()
          ).map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      ) : (
        <select onChange={(e) => setNewScore({ ...newScore, date: e.target.value })}>
          <option value="">선택</option>
          {["고1", "고2", "고3"].flatMap((grade) =>
            ["3월", "6월", "9월", "10월"].map((month) => `${grade} ${month}`)
          ).map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      )}

      <input type="number" placeholder="점수" onChange={(e) => setNewScore({ ...newScore, score: e.target.value })} />
      <button onClick={addScore}>추가</button>

      <hr />

      {filteredStudents.map((s) => (
        <div key={s.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
          <h4>{s.name} ({s.school} {s.grade}학년, {s.teacher})</h4>

          <strong>내신 성적 추이</strong>
          <Line data={graphData(s, "내신")} />
          <strong>모의고사 성적 추이</strong>
          <Line data={graphData(s, "모의고사")} />

          <ul>
            {s.scores.map((sc, i) => (
              <li key={i}>
                [{sc.type}] {sc.date} {sc.subject}: {sc.score}점
                <button onClick={() => deleteScore(s.id, i)}>삭제</button>
              </li>
            ))}
          </ul>
          <button onClick={() => deleteStudent(s.id)}>학생 삭제</button>
        </div>
      ))}
    </div>
  );
}

export default App;
