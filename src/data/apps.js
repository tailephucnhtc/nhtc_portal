import {
  Users,
  BarChart2,
  Plane,
  Box,
  Home,
  Truck,
  DoorOpen,
  Clock,
  PenTool,
  Phone,
  AlertTriangle,
  Settings,
  Calendar,
  ShoppingCart,
  Wrench,
  FileText,
  DollarSign,
  Smile,
  List,
  Book,
  Briefcase,
  MessageCircle,
  Sparkles,
  Download,
  CheckSquare
} from 'lucide-react';

export const appsData = [
  {
    category: "Thông tin chung",
    items: [
      {
        id: 18,
        title: "Nghỉ phép",
        subtitle: "Đăng ký nghỉ phép",
        department: "NHÂN SỰ",
        icon: "Calendar",
        color: "pink",
        url: "https://docs.google.com/forms/d/e/1FAIpQLScpy2mDBFhrosSr5MAP0ZUYnGAP0wbHHbb2CoGd1f2AlhAtHQ/viewform",
        selected: true,
        keywords: ["về sớm", "nghỉ ốm", "nghi phep", "đi trễ", "nghỉ việc riêng", "xin phép"]
      },
      {
        id: 19,
        title: "Chấm công",
        subtitle: "Bảng theo dõi chấm công",
        department: "NHÂN SỰ",
        icon: "Clock",
        color: "green",
        url: "https://docs.google.com/spreadsheets/d/1wTmdFxxOsQ7shX-BOnIqzQX0LYOim2wOiMVoasSNwGY/edit?gid=667288789#gid=667288789",
        keywords: ["bảng công", "giờ làm", "check in", "check out", "cham cong"]
      },
      {
        id: 20,
        title: "Đơn đăng kí OT",
        subtitle: "Đăng ký làm thêm giờ",
        department: "NHÂN SỰ",
        icon: "FileText",
        color: "purple",
        url: "https://docs.google.com/forms/d/e/1FAIpQLScD_gaYSUvxlsqCwSxLm6wt3RomonCm16OYQUrEYMG20l_mbQ/viewform",
        keywords: ["tăng ca", "làm thêm", "overtime", "ot", "ngoài giờ"]
      },
      { id: 1, title: "Chat Bot", subtitle: "Hỗ trợ trực tuyến", department: "HÀNH CHÍNH", icon: "MessageCircle", color: "blue", url: "https://www.chatbase.co/chatbot-iframe/mZZQH3jbxGps15IYzNbUQ", keywords: ["trợ lý", "bot", "hỗ trợ", "help"] },
      { id: 2, title: "Mẫu chữ ký email", subtitle: "Mẫu chữ ký chuẩn", department: "HÀNH CHÍNH", icon: "PenTool", color: "orange", url: "https://docs.google.com/document/d/1SjhkMYI4-t2SEHtyRnIu3sRhFrkF3i9W/edit", keywords: ["email", "chữ ký", "signature", "thư điện tử"] },
      { id: 3, title: "Quy trình vệ sinh công ty", subtitle: "Quy trình vệ sinh", department: "HÀNH CHÍNH", icon: "Sparkles", color: "green", url: "https://docs.google.com/document/d/1L6ya5qt9udySgI1bWtDDq4LbqeKAbB1sC2clj-rN3DY/edit?tab=t.0", keywords: ["dọn dẹp", "vệ sinh", "sạch sẽ", "quy định"] },
      { id: 4, title: "Quy trình quản lý công ty", subtitle: "Tài liệu quản lý", department: "HÀNH CHÍNH", icon: "FileText", color: "purple", url: "https://drive.google.com/drive/folders/1lFnHoj6NXq-_h_UxTyFbXLEUp0i7lfb9", keywords: ["quản lý", "tài liệu", "quy trình", "hướng dẫn"] },
      { id: 5, title: "Quay số may mắn", subtitle: "Quay số trúng thưởng", department: "HÀNH CHÍNH", icon: "Smile", color: "red", url: "https://script.google.com/macros/s/AKfycbxrFFfkowYBSrF735sHTSpA4TT4ICbIVrLrdYOPqTXJTlh24o4vhVKHKVmCHf9BDp-r/exec", keywords: ["quay số", "may mắn", "trúng thưởng", "lucky draw", "game"] },
    ]
  },
  {
    category: "Khách hàng",
    items: [
      {
        id: 60,
        title: "CCJ",
        subtitle: "Carekarte Ontrak",
        department: "KINH DOANH",
        icon: "/ccj.png",
        color: "blue",
        url: "https://ccj.carekarte.ontrak.live/auth/signin",
        keywords: ["carekarte", "ontrak", "nhật bản", "đối tác", "khách hàng", "kinh doanh", "ccj"]
      },
    ]
  },
  {
    category: "Nghiệp vụ",
    items: [


      // Sản Xuất
      { id: 30, title: "Quy trình nhập kho & giao hàng cho SMT", subtitle: "Quy trình nhập kho", department: "SẢN XUẤT", icon: "Box", color: "blue", url: "https://docs.google.com/spreadsheets/d/10SOf05Wa9ughARSiX_xa7W88ouCL5t_KOEtOjHT7hSg/edit?gid=0#gid=0", keywords: ["kho", "smt", "nhập hàng", "giao hàng", "xuất kho"] },
      { id: 31, title: "Quy trình & tài liệu kỹ thuật", subtitle: "Tài liệu kỹ thuật", department: "SẢN XUẤT", icon: "Book", color: "purple", url: "https://drive.google.com/drive/folders/1OWpQ8hrqE9n-qGUtUx4hHBhZV6dM7V25", keywords: ["kỹ thuật", "tài liệu", "hướng dẫn kỹ thuật", "spec"] },
      { id: 32, title: "Report kết quả test", subtitle: "Báo cáo test", department: "SẢN XUẤT", icon: "BarChart2", color: "red", url: "https://drive.google.com/drive/folders/1aNOSCuRCdc3plZLh70ZkT6htgDOeZ2hC", keywords: ["báo cáo", "test", "kết quả", "report", "kiểm tra"] },

      // Mua Hàng
      { id: 40, title: "Quy trình thiết kế - đặt hàng CNC / Label", subtitle: "Quy trình CNC/Label", department: "MUA HÀNG", icon: "PenTool", color: "orange", url: "https://docs.google.com/spreadsheets/d/18dkTFYxqn0u7yD2QzPuNIQiF-K_jH22zrZMEyBLVSKw/edit?gid=1859464171#gid=1859464171", keywords: ["cnc", "label", "nhãn", "đặt hàng", "thiết kế"] },
      { id: 41, title: "Quy trình gửi BOM List & Mua vật tư", subtitle: "BOM & Vật tư", department: "MUA HÀNG", icon: "ShoppingCart", color: "blue", url: "https://script.google.com/a/macros/nhtc.com.vn/s/AKfycbxaNeSSELvG-MPLdKPTwcMf-OOUnsv0NqThk-GieNI/dev", keywords: ["bom list", "vật tư", "mua hàng", "linh kiện"] },

      // Tools
      { id: 50, title: "Tool Test Hachi", subtitle: "Tải Tool Test Hachi", department: "TEST", icon: "Download", color: "green", url: "/Hachi.rar", keywords: ["hachi", "tool test", "kiểm tra", "phần mềm"] },
      { id: 51, title: "Tool Test Sync", subtitle: "Tải Tool Test Sync", department: "TEST", icon: "Download", color: "blue", url: "/SYNC.rar", keywords: ["sync", "đồng bộ", "tool test"] },
      { id: 52, title: "Tool Test Module", subtitle: "Tải Tool Test Module", department: "TEST", icon: "Download", color: "purple", url: "/ToolTest_Module.rar", keywords: ["module", "mô đun", "tool test"] },
    ]
  }
];
