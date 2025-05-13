  export const calculatePopupPosition = (indicatorPosition:{x:number,y:number}) => {
    const popupPosition = {
      top: indicatorPosition.y + 56,
      left: indicatorPosition.x,
      transformOrigin: "top left",
    }
    if (indicatorPosition.y + 56 + 120 > window.innerHeight) {
      popupPosition.top = indicatorPosition.y - 120
      popupPosition.transformOrigin = "bottom left"
    }

    if (indicatorPosition.x + 220 > window.innerWidth) {
      popupPosition.left = indicatorPosition.x - 220 + 100 
      popupPosition.transformOrigin = `${popupPosition.transformOrigin.split(" ")[0]} right`
    }

    return popupPosition
  }
  