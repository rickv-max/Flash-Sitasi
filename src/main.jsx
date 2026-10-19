import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import Site from './Site.jsx'

const root = document.getElementById('root')
const content = <StrictMode><Site /></StrictMode>
if (root.hasChildNodes()) hydrateRoot(root, content)
else createRoot(root).render(content)
