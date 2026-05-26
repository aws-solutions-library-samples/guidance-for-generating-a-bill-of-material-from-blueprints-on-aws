// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Routes, Route } from "react-router-dom"
import BlueprintPage from "./BlueprintPage"
import ChatPage from "./ChatPage"
import ArchitecturePage from "./ArchitecturePage"

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<BlueprintPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/architecture" element={<ArchitecturePage />} />
    </Routes>
  )
}
