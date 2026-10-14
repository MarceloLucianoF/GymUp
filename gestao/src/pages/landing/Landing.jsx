import React from 'react';
import { Link } from 'react-router-dom';
export default function Landing() { return <main className="center"><h1>A gestão da sua academia em um só lugar.</h1><Link className="btn primary" to="/login?modo=cadastro">Criar academia</Link></main>; }
