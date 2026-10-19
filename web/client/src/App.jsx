import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import Home from './pages/Home';
import Market from './pages/Market';
import Franchises from './pages/Franchises';
import ValueMap from './pages/ValueMap';
import Steals from './pages/Steals';
import Roles from './pages/Roles';
import Brackets from './pages/Brackets';
import Players from './pages/Players';
import SquadBuilder from './pages/SquadBuilder';
import Methodology from './pages/Methodology';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <NavBar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/market" element={<Market />} />
            <Route path="/franchises" element={<Franchises />} />
            <Route path="/value-map" element={<ValueMap />} />
            <Route path="/steals" element={<Steals />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/brackets" element={<Brackets />} />
            <Route path="/players" element={<Players />} />
            <Route path="/players/:id" element={<Players />} />
            <Route path="/squad-builder" element={<SquadBuilder />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
